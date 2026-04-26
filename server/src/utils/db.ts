import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
// We find the project root by looking for a directory named 'server' that is not 'dist'
const findDataDir = () => {
  // If we are in Docker/Production, we know the path is /app/server/data
  if (process.env.NODE_ENV === 'production') {
    return '/app/server/data';
  }
  
  // Local development: always point to the actual server/data folder
  // __dirname can be server/src/utils OR server/dist/server/src/utils
  const root = __dirname.includes('dist') 
    ? path.join(__dirname, '../../../../..') 
    : path.join(__dirname, '../../..');
    
  return path.join(root, 'server/data');
};

const dataDir = findDataDir();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cloudstream.db');
const db: Database.Database = new Database(dbPath);

console.log('[DB] Database localized at', dbPath);

// Enable Write-Ahead Logging for better performance
db.pragma('journal_mode = WAL');

// Migrations
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS HomeCache (
      pluginId TEXT PRIMARY KEY,
      data TEXT,
      lastUpdated INTEGER
    );

    CREATE TABLE IF NOT EXISTS MediaCache (
      id TEXT PRIMARY KEY, -- pluginId|url
      pluginId TEXT,
      url TEXT,
      data TEXT,
      lastUpdated INTEGER
    );
  `);

  // Default settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO Settings (key, value) VALUES (?, ?)');
  insertSetting.run('cacheData', 'true');
  insertSetting.run('syncEnabled', 'true');
  insertSetting.run('downloadImagesLocally', 'false');
  insertSetting.run('recursiveHomeSync', 'false');
  insertSetting.run('recursiveSeriesSync', 'false');
  insertSetting.run('recursiveConcurrency', '2');
}

export default db;
