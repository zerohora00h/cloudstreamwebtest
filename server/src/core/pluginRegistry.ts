import fs from 'fs';
import path from 'path';
import type { HomeSection, MediaDetails, MediaItem, PluginAPI, StreamLink } from '../../../shared/types';

const ALLOWED_MEDIA_KEYS: (keyof MediaItem)[] = ['name', 'url', 'type', 'posterUrl', 'year', 'score'];
const ALLOWED_SECTION_KEYS: (keyof HomeSection)[] = ['name', 'list'];

function sanitizeMediaItem(raw: any): MediaItem {
  return {
    name: String(raw.name || ''),
    url: String(raw.url || ''),
    type: ['Movie', 'TvSeries', 'Anime'].includes(raw.type) ? raw.type : 'Movie',
    posterUrl: String(raw.posterUrl || ''),
    year: raw.year != null ? Number(raw.year) || null : null,
    score: raw.score != null ? Number(raw.score) || null : null,
    audio: raw.audio ? String(raw.audio) : undefined,
  };
}

function sanitizeHomeSection(raw: any): HomeSection {
  return {
    name: String(raw.name || ''),
    list: Array.isArray(raw.list) ? raw.list.map(sanitizeMediaItem) : [],
  };
}

function sanitizeDetails(raw: any): MediaDetails {
  return {
    name: String(raw.name || ''),
    url: String(raw.url || ''),
    type: ['Movie', 'TvSeries', 'Anime'].includes(raw.type) ? raw.type : 'Movie',
    posterUrl: String(raw.posterUrl || ''),
    plot: raw.plot ? String(raw.plot) : undefined,
    year: raw.year != null ? Number(raw.year) || null : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    score: raw.score != null ? Number(raw.score) || null : null,
    duration: raw.duration != null ? Number(raw.duration) || null : null,
    dataUrl: raw.dataUrl ? String(raw.dataUrl) : undefined,
    seasons: Array.isArray(raw.seasons) ? raw.seasons.map(Number) : undefined,
    episodes: Array.isArray(raw.episodes) ? raw.episodes.map((ep: any) => ({
      name: String(ep.name || ''),
      season: Number(ep.season) || 0,
      episode: Number(ep.episode) || 0,
      data: String(ep.data || ''),
    })) : undefined,
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations.map(sanitizeMediaItem) : undefined,
  };
}

function sanitizeStreamLink(raw: any): StreamLink {
  return {
    name: String(raw.name || ''),
    url: String(raw.url || ''),
    quality: String(raw.quality || 'Auto'),
    type: raw.type, // Preserve type if exists ('hls' | 'mp4')
    referer: raw.referer ? String(raw.referer) : undefined,
    headers: raw.headers, // Also preserve headers
  };
}

/**
 * Wraps a raw plugin module with type-safe sanitization.
 * This ensures plugins can only return expected data shapes,
 * no matter what the plugin code actually does.
 */
function wrapPlugin(raw: any): PluginAPI {
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: String(raw.description || ''),
    version: String(raw.version || '1.0.0'),

    async getHome(): Promise<HomeSection[]> {
      const result = await raw.getHome();
      return Array.isArray(result) ? result.map(sanitizeHomeSection) : [];
    },

    async search(query: string): Promise<MediaItem[]> {
      const result = await raw.search(query);
      return Array.isArray(result) ? result.map(sanitizeMediaItem) : [];
    },

    async load(url: string): Promise<MediaDetails> {
      const result = await raw.load(url);
      return sanitizeDetails(result);
    },

    async loadLinks(data: string): Promise<StreamLink[]> {
      const result = await raw.loadLinks(data);
      return Array.isArray(result) ? result.map(sanitizeStreamLink) : [];
    },
  };
}

export class PluginRegistry {
  private static plugins: Map<string, PluginAPI> = new Map();

  static async loadAll(pluginsDir: string): Promise<void> {
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
      console.log(`[Plugin] Directory created: ${pluginsDir}`);
      return;
    }

    const { pathToFileURL } = require('url');
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = path.join(pluginsDir, entry.name);
      const manifestPath = path.join(pluginPath, 'plugin.json');

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        let mainFile = manifest.main || 'index.js';
        let mainPath = path.join(pluginPath, mainFile);

        // In production/Docker, .ts files are compiled to .js
        if (!fs.existsSync(mainPath) && mainFile.endsWith('.ts')) {
          mainFile = mainFile.replace('.ts', '.js');
          mainPath = path.join(pluginPath, mainFile);
        }

        if (!fs.existsSync(mainPath)) {
          console.warn(`[Plugin] Main file not found for ${entry.name}: ${mainFile}`);
          continue;
        }

        const fileUrl = pathToFileURL(mainPath).href;
        const mod = await import(fileUrl);
        const raw = mod.default || mod;

        // Merge manifest data with plugin logic
        const pluginData = {
          ...raw,
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          version: manifest.version
        };

        const plugin = wrapPlugin(pluginData);
        this.plugins.set(plugin.id, plugin);

        // Load local extractors if they exist
        const localExtractorsDir = path.join(pluginPath, 'extractors');
        if (fs.existsSync(localExtractorsDir)) {
          const { ExtractorManager } = require('./extractorManager');
          await ExtractorManager.loadFromDir(localExtractorsDir);
        }

        console.log(`[Plugin] Loaded: ${plugin.name} (${plugin.id})`);
      } catch (err: any) {
        console.error(`[Plugin] Error loading ${entry.name}:`, err.message);
      }
    }
  }

  static getAll(): PluginAPI[] {
    return Array.from(this.plugins.values());
  }

  static getById(id: string): PluginAPI | undefined {
    return this.plugins.get(id);
  }

  static getManifests() {
    return this.getAll().map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
    }));
  }
}
