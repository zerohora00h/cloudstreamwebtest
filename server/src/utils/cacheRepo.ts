import db from './db';

// ===== HOME CACHE =====
export function getHomeCache(pluginId: string) {
  const stmt = db.prepare('SELECT data, lastUpdated FROM HomeCache WHERE pluginId = ?');
  const result = stmt.get(pluginId) as { data: string; lastUpdated: number } | undefined;

  if (result) {
    return { data: JSON.parse(result.data), lastUpdated: result.lastUpdated };
  }
  return null;
}

export function saveHomeCache(pluginId: string, data: any) {
  const stmt = db.prepare(`
    INSERT INTO HomeCache (pluginId, data, lastUpdated)
    VALUES (?, ?, ?)
    ON CONFLICT(pluginId) DO UPDATE SET
      data = excluded.data,
      lastUpdated = excluded.lastUpdated
  `);
  const lastUpdated = Date.now();
  stmt.run(pluginId, JSON.stringify(data), lastUpdated);
  console.log(`[Cache] Home updated for plugin: ${pluginId}`);
}

// ===== MEDIA CACHE (Filmes, Séries, Links) =====
export function getMediaCache(pluginId: string, url: string) {
  const id = `${pluginId}|${url}`;
  const stmt = db.prepare('SELECT data, lastUpdated FROM MediaCache WHERE id = ?');
  const result = stmt.get(id) as { data: string; lastUpdated: number } | undefined;

  if (result) {
    return { data: JSON.parse(result.data), lastUpdated: result.lastUpdated };
  }
  return null;
}

export function saveMediaCache(pluginId: string, url: string, data: any) {
  const id = `${pluginId}|${url}`;
  const stmt = db.prepare(`
    INSERT INTO MediaCache (id, pluginId, url, data, lastUpdated)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      lastUpdated = excluded.lastUpdated
  `);
  const lastUpdated = Date.now();
  stmt.run(id, pluginId, url, JSON.stringify(data), lastUpdated);
  // console.log(`[Cache] Media details cached: ${pluginId} -> ${url.substring(0, 40)}...`);
}

// ===== SETTINGS =====
export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM Settings WHERE key = ?');
  const result = stmt.get(key) as { value: string } | undefined;
  return result ? result.value : null;
}

export function saveSetting(key: string, value: string) {
  const stmt = db.prepare('UPDATE Settings SET value = ? WHERE key = ?');
  const result = stmt.run(value, key);

  // Se não atualizou, insere
  if (result.changes === 0) {
    const insert = db.prepare('INSERT INTO Settings (key, value) VALUES (?, ?)');
    insert.run(key, value);
  }
}
