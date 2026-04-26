if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const moduleAlias = require('module-alias');
const path = require('path');

moduleAlias.addAliases({
  "@shared": path.join(__dirname, '../../shared'),
  "@utils": path.join(__dirname, 'utils'),
  "@plugin-api": path.join(__dirname, 'core/plugin-api/api')
});

import cors from 'cors';
import express from 'express';
import fs from 'fs';
import os from 'os';
import { PluginRegistry } from './core/pluginRegistry';
import { pluginRoutes } from './routes/plugins';
import { streamRoutes } from './routes/stream';
import { settingsRoutes } from './routes/settings';
import { tmdbRoutes } from './routes/tmdb';
import { initDB } from './utils/db';
import { initStremioAddon } from './core/stremio';

initDB();
initStremioAddon();

// Disable SSL verification for problematic streaming sites
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 8085;
const BOOT_ID = Date.now().toString(); // ID único para esta sessão do servidor

app.use(cors());
app.use(express.json());

// Smart request logger — groups burst requests into summaries
const logState = {
  lastKey: '',
  count: 0,
  startTime: 0,
  timer: null as ReturnType<typeof setTimeout> | null,
};

function flushLog() {
  if (logState.count === 0) return;
  if (logState.count === 1) {
    console.log(`[Server] ${logState.lastKey}`);
  } else {
    const elapsed = ((Date.now() - logState.startTime) / 1000).toFixed(1);
    console.log(`[Server] ${logState.lastKey} ×${logState.count} (${elapsed}s)`);
  }
  logState.count = 0;
  logState.lastKey = '';
  logState.timer = null;
}

app.use((req, res, next) => {
  // Normalize URL to a route pattern for grouping (strip query params)
  const route = req.url.split('?')[0];
  const key = `${req.method} ${route}`;

  // Ignore noisy stream logs
  if (route === '/api/stream') {
    return next();
  }

  if (key === logState.lastKey) {
    logState.count++;
    // Reset the flush timer — keep buffering while burst continues
    if (logState.timer) clearTimeout(logState.timer);
    logState.timer = setTimeout(flushLog, 500);
  } else {
    // Different route — flush the previous batch and start a new one
    if (logState.timer) clearTimeout(logState.timer);
    flushLog();
    logState.lastKey = key;
    logState.count = 1;
    logState.startTime = Date.now();
    logState.timer = setTimeout(flushLog, 500);
  }

  next();
});

// Load plugins
(async () => {
  const pluginsDir = path.join(__dirname, 'plugins');
  await PluginRegistry.loadAll(pluginsDir);
})();

// API routes
app.get('/api/config', (_req, res) => res.json({ bootId: BOOT_ID }));
app.use('/api', pluginRoutes);
app.use('/api', streamRoutes);
app.use('/api', settingsRoutes);
app.use('/api', tmdbRoutes);

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
};

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Use process.cwd() to consistently point to /app/client/dist in Docker
  const clientPath = path.join(process.cwd(), 'client/dist');
  app.use(express.static(clientPath));
  
  // Fallback for SPA: If no API route matched, serve index.html
  // This approach avoids path-to-regexp issues in Express 5
  app.use((req, res, next) => {
    // Don't intercept API calls (they should 404 if not found)
    if (req.url.startsWith('/api')) {
      return next();
    }
    
    const indexPath = path.join(clientPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
  
  console.log(`[Server] Production mode: Serving client from ${clientPath}`);
}


app.listen(PORT, () => {
  console.log(`[Server] Local:   http://localhost:${PORT}`);
  const networkAddress = getLocalIp();
  const hostname = os.hostname().toLowerCase() + '.local';
  
  console.log(`[Server] Rede IP: http://${networkAddress}:${PORT}`);
  console.log(`[Server] Host:    http://${hostname}:${PORT}`);
});
