import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { HomeSection, MediaDetails, MediaItem, StreamLink } from '../../../../shared/types';

// --- API object injected into plugins and extractors ---

export interface PluginHttpApi {
  get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
  post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse>;
}

export interface PluginHtmlApi {
  parse(html: string): cheerio.CheerioAPI;
}

export interface PluginSandboxApi {
  request: PluginHttpApi;
  html: PluginHtmlApi;
}

const sandboxApi: PluginSandboxApi = {
  request: {
    get: (url, config) => axios.get(url, config),
    post: (url, data, config) => axios.post(url, data, config),
  },
  html: {
    parse: (html) => cheerio.load(html),
  },
};

// --- createPlugin ---

export interface PluginMethods {
  getHome(): Promise<HomeSection[]>;
  search(query: string): Promise<MediaItem[]>;
  load(url: string): Promise<MediaDetails>;
  loadLinks(data: string): Promise<StreamLink[]>;
}

export function createPlugin(
  factory: (api: PluginSandboxApi) => PluginMethods
): PluginMethods {
  return factory(sandboxApi);
}

// --- createExtractor ---

export interface ExtractorMethods {
  name: string;
  domains: string[];
  extract(url: string): Promise<StreamLink[] | null>;
}

export function createExtractor(
  factory: (api: PluginSandboxApi) => ExtractorMethods
): ExtractorMethods {
  return factory(sandboxApi);
}
