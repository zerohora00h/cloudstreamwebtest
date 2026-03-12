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
}

export interface MultiSearchResult {
  pluginId: string;
  pluginName: string;
  results: MediaItem[];
}

export const api = {
  async getConfig(): Promise<{ bootId: string }> {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },

  async getPlugins(): Promise<PluginManifest[]> {
    const res = await fetch(`${API_BASE}/plugins`);
    return res.json();
  },

  async getHome(pluginId: string): Promise<HomeSection[]> {
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/home`);
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

  async load(pluginId: string, url: string): Promise<MediaDetails> {
    const res = await fetch(`${API_BASE}/plugins/${pluginId}/load`, {
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
};
