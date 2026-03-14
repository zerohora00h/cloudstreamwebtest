import { Request, Response, Router } from 'express';
import { ExtractorManager } from '../core/extractorManager';
import { PluginRegistry } from '../core/pluginRegistry';
import { getHomeCache, saveHomeCache, getSetting, getMediaCache, saveMediaCache } from '../utils/cacheRepo';

export const pluginRoutes = Router();

pluginRoutes.get('/plugins', (_req: Request, res: Response) => {
  res.json(PluginRegistry.getManifests());
});

pluginRoutes.get('/plugins/:id/home', async (req: Request, res: Response) => {
  try {
    const pluginId = req.params.id as string;
    const plugin = PluginRegistry.getById(pluginId);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const isCacheEnabled = getSetting('cacheData') !== 'false';
    const forceFresh = req.query.fresh === 'true';

    let cached = null;
    if (isCacheEnabled && !forceFresh) {
      cached = getHomeCache(pluginId);
      if (cached) {
        // Return quickly
        res.json(cached.data);
      }
    }

    // Trigger async background refresh (or block if no cache)
    const fetchFreshContent = async () => {
      try {
        const freshData = await plugin.getHome();
        
        // Se conseguimos dados válidos e cache está ativado, vamos atualizar
        if (isCacheEnabled && freshData && freshData.length > 0) {
          saveHomeCache(pluginId, freshData);
        }

        return freshData;
      } catch (err) {
        console.error('[Sync] Background home fetch error:', err);
        throw err;
      }
    };

    if (cached) {
      // Async refresh since we already answered the user
      fetchFreshContent().catch(() => {});
    } else {
      // Wait to respond because we have no cache
      const freshData = await fetchFreshContent();
      res.json(freshData);
    }
  } catch (error: any) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Multi-plugin search: queries all plugins in parallel
pluginRoutes.get('/plugins/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const plugins = PluginRegistry.getAll();
    const results = await Promise.allSettled(
      plugins.map(async (plugin) => ({
        pluginId: plugin.id,
        pluginName: plugin.name,
        results: await plugin.search(query),
      }))
    );

    const data = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r.results.length > 0);

    res.json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Single-plugin search
pluginRoutes.get('/plugins/:id/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const data = await plugin.search(query);
    res.json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

pluginRoutes.post('/plugins/:id/load', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const pluginId = req.params.id as string;
    const plugin = PluginRegistry.getById(pluginId);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const isCacheEnabled = getSetting('cacheData') !== 'false';
    const forceFresh = req.query.fresh === 'true';

    let cached = null;
    if (isCacheEnabled && !forceFresh) {
      cached = getMediaCache(pluginId, url);
      if (cached) {
        res.json(cached.data);
      }
    }

    const fetchFreshMedia = async () => {
      try {
        const freshData = await plugin.load(url);
        
        if (isCacheEnabled && freshData) {
          saveMediaCache(pluginId, url, freshData);
        }
        return freshData;
      } catch (err) {
        console.error(`[Sync] Background media load error for ${url}:`, err);
        throw err;
      }
    };

    if (cached) {
      fetchFreshMedia().catch(() => {});
    } else {
      const freshData = await fetchFreshMedia();
      res.json(freshData);
    }
  } catch (error: any) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

pluginRoutes.post('/plugins/:id/links', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Data is required' });

    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const rawLinks = await plugin.loadLinks(data);
    const finalLinks = [];

    for (const link of rawLinks) {
      if (!link.url) { finalLinks.push(link); continue; }


      // 1. Try local plugin extractors first (scoped to this plugin)
      let extracted = null;
      if (plugin.extractors && plugin.extractors.length > 0) {
        for (const extractor of plugin.extractors) {
          if (extractor.domains.some(d => link.url.includes(d))) {
            try {
              extracted = await extractor.extract(link.url);
              if (extracted && extracted.length > 0) {
                console.log(`[Extractor] Hit: ${extractor.name} (${plugin.id})`);
                break;
              }
            } catch (e: any) {
              console.error(`[Extractor] Local ${extractor.name} error:`, e.message);
            }
          }
        }
      }

      // 2. Fallback to global ExtractorManager
      if (!extracted || extracted.length === 0) {
        extracted = await ExtractorManager.extract(link.url);
      }

      if (extracted && extracted.length > 0) {
        for (const e of extracted) {
          const proxyUrl = `/api/stream?url=${encodeURIComponent(e.url)}&referer=${encodeURIComponent(e.referer || link.url)}`;
          finalLinks.push({ ...e, url: proxyUrl });
        }
      } else {
        // Even if not extracted by a separate extractor, proxy the direct link
        const proxyUrl = `/api/stream?url=${encodeURIComponent(link.url)}&referer=${encodeURIComponent(link.referer || link.url)}`;
        finalLinks.push({ ...link, url: proxyUrl });
      }
    }

    res.json(finalLinks);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
