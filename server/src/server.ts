const moduleAlias = require('module-alias');
const path = require('path');

moduleAlias.addAliases({
  "@shared": path.join(__dirname, '../../shared'),
  "@utils": path.join(__dirname, 'utils'),
  "@plugin-api": path.join(__dirname, 'core/plugin-api/api')
});

import cors from 'cors';
import express from 'express';
import { PluginRegistry } from './core/pluginRegistry';
import { pluginRoutes } from './routes/plugins';
import { streamRoutes } from './routes/stream';
import { settingsRoutes } from './routes/settings';
import { initDB } from './utils/db';

initDB();

// Disable SSL verification for problematic streaming sites
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3001;
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

app.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
});
