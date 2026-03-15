const API_BASE = '/api';

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
}

export type MediaType = 'Movie' | 'TvSeries' | 'Anime';

export interface MediaItem {
  name: string;
  url: string;
  type: MediaType;
  posterUrl: string;
  year?: number | null;
  score?: number | null;
  audio?: string;
}

export interface HomeSection {
  name: string;
  list: MediaItem[];
}

export interface Episode {
  name: string;
  season: number;
  episode: number;
  data: string;
}

export interface MediaDetails {
  name: string;
  url: string;
  type: MediaType;
  posterUrl: string;
  plot?: string;
  year?: number | null;
  tags?: string[];
  score?: number | null;
  duration?: number | null;
  dataUrl?: string;
  seasons?: number[];
  episodes?: Episode[];
  recommendations?: MediaItem[];
}

export interface StreamLink {
  type: string;
  name: string;
  url: string;
  quality: string;
  referer?: string;
  status?: 'raw' | 'extracting' | 'extracted' | 'error';
}

export interface MultiSearchResult {
  pluginId: string;
  pluginName: string;
  results: MediaItem[];
}

export interface AppSettings {
  cacheData: boolean;
  syncEnabled: boolean;
  downloadImagesLocally: boolean;
  recursiveHomeSync: boolean;
  recursiveSeriesSync: boolean;
  recursiveConcurrency: number;
}

export const api = {
  async getConfig(): Promise<{ bootId: string }> {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },

  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async getPlugins(): Promise<PluginManifest[]> {
    const res = await fetch(`${API_BASE}/plugins`);
    return res.json();
  },

  async getHome(pluginId: string, forceFresh = false): Promise<HomeSection[]> {
    const freshQuery = forceFresh ? '?fresh=true' : '';
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/home${freshQuery}`);
    return res.json();
  },

  async search(pluginId: string, query: string): Promise<MediaItem[]> {
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  async searchAll(query: string): Promise<MultiSearchResult[]> {
    const res = await fetch(`${API_BASE}/plugins/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  async load(pluginId: string, url: string, forceFresh = false): Promise<MediaDetails> {
    const freshQuery = forceFresh ? '?fresh=true' : '';
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/load${freshQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return res.json();
  },

  async loadLinks(pluginId: string, data: string): Promise<StreamLink[]> {
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    return res.json();
  },

  async getRawLinks(pluginId: string, data: string, forceFresh = false): Promise<StreamLink[]> {
    const freshQuery = forceFresh ? '?fresh=true' : '';
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/raw-links${freshQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    return res.json();
  },

  async extractLink(pluginId: string, link: StreamLink): Promise<StreamLink[]> {
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link }),
    });
    return res.json();
  },
};
