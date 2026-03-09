import cors from 'cors';
import express from 'express';
import path from 'path';
import { PluginRegistry } from './core/pluginRegistry';
import { pluginRoutes } from './routes/plugins';
import { streamRoutes } from './routes/stream';

// Disable SSL verification for problematic streaming sites
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Request logger for debugging
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// Load plugins
const pluginsDir = path.join(__dirname, 'plugins');
PluginRegistry.loadAll(pluginsDir);

// API routes
app.use('/api', pluginRoutes);
app.use('/api', streamRoutes);

app.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
});
