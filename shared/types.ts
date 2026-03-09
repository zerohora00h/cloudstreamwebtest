// Plugin manifest / metadata
export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  lang?: string;
  iconUrl?: string;
}

// Content types
export type MediaType = 'Movie' | 'TvSeries' | 'Anime';

// A single media item (used in home lists and search results)
export interface MediaItem {
  name: string;
  url: string;
  type: MediaType;
  posterUrl: string;
  year?: number | null;
  score?: number | null;
}

// A section on the home page (e.g. "Ação", "Populares")
export interface HomeSection {
  name: string;
  list: MediaItem[];
}

// Full media details (movie or series)
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
  episodes?: Episode[];
  recommendations?: MediaItem[];
}

export interface Episode {
  name: string;
  season: number;
  episode: number;
  data: string;
}

// A resolved streaming link
export interface StreamLink {
  name: string;
  url: string;
  quality: string;
  type?: 'hls' | 'mp4'; // Added to help player detection
  referer?: string;
}

// The contract every plugin must implement
export interface PluginAPI {
  id: string;
  name: string;
  description: string;
  version: string;
  extractors?: ExtractorAPI[];
  getHome(): Promise<HomeSection[]>;
  search(query: string): Promise<MediaItem[]>;
  load(url: string): Promise<MediaDetails>;
  loadLinks(data: string): Promise<StreamLink[]>;
}

// Extractor contract
export interface ExtractorAPI {
  name: string;
  domains: string[];
  extract(url: string): Promise<StreamLink[] | null>;
}
