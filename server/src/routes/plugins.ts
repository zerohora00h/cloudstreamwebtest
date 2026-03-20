import { Request, Response, Router } from 'express';
import { ExtractorManager } from '../core/extractorManager';
import { PluginRegistry } from '../core/pluginRegistry';
import { getHomeCache, getMediaCache, getSetting, saveHomeCache, saveMediaCache } from '../utils/cacheRepo';

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

    if (isCacheEnabled) {
      const cached = getHomeCache(pluginId);
      if (cached) return res.json(cached.data);
    }

    const freshData = await plugin.getHome();

    if (isCacheEnabled && freshData && freshData.length > 0) {
      saveHomeCache(pluginId, freshData);
    }

    res.json(freshData);
  } catch (error: any) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

pluginRoutes.post('/plugins/:id/home/check', async (req: Request, res: Response) => {
  try {
    const pluginId = req.params.id as string;
    const plugin = PluginRegistry.getById(pluginId);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const isCacheEnabled = getSetting('cacheData') !== 'false';
    const cached = isCacheEnabled ? getHomeCache(pluginId) : null;

    const freshData = await plugin.getHome();

    if (!freshData || freshData.length === 0) {
      return res.json({ changed: false });
    }

    if (!cached || !cached.data || cached.data.length === 0) {
      if (isCacheEnabled) saveHomeCache(pluginId, freshData);
      return res.json({ changed: true, sections: freshData, updatedSections: freshData.map((s: any) => s.name) });
    }

    const cachedSections: any[] = cached.data;
    const updatedSections: string[] = [];

    for (const freshSection of freshData) {
      const cachedSection = cachedSections.find((cs: any) => cs.name === freshSection.name);

      if (!cachedSection || cachedSection.list.length === 0) {
        updatedSections.push(freshSection.name);
        continue;
      }

      const freshFirst = freshSection.list[0];
      const cachedFirst = cachedSection.list[0];

      if (freshFirst.url !== cachedFirst.url) {
        updatedSections.push(freshSection.name);
      }
    }

    if (updatedSections.length === 0) {
      return res.json({ changed: false });
    }

    if (isCacheEnabled) saveHomeCache(pluginId, freshData);

    console.log(`[SmartSync] ${updatedSections.length} section(s) changed for ${pluginId}: ${updatedSections.join(', ')}`);
    return res.json({ changed: true, sections: freshData, updatedSections });
  } catch (error: any) {
    console.error('[SmartSync] Error:', error);
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
      fetchFreshMedia().catch(() => { });
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

    const pluginId = req.params.id as string;
    const plugin = PluginRegistry.getById(pluginId);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const rawLinks = await plugin.loadLinks(data);
    const finalLinks = [];

    for (const link of rawLinks) {
      const extracted = await performExtraction(plugin, link);
      finalLinks.push(...extracted);
    }

    res.json(finalLinks);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

pluginRoutes.post('/plugins/:id/raw-links', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const forceFresh = req.query.fresh === 'true';
    if (!data) return res.status(400).json({ error: 'Data is required' });

    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    // Note: Plugins currently handle their internal request caching. 
    // We pass any forceFresh hint if the plugin API supports it in the future,
    // or we just rely on the fact that this call is being explicitly made.
    const rawLinks = await plugin.loadLinks(data);
    res.json(rawLinks);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

pluginRoutes.post('/plugins/:id/extract', async (req: Request, res: Response) => {
  try {
    const { link } = req.body;
    if (!link || !link.url) return res.status(400).json({ error: 'Link with URL is required' });

    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const extracted = await performExtraction(plugin, link);
    res.json(extracted);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

async function performExtraction(plugin: any, link: any) {
  if (!link.url) return [link];

  // 1. Try local plugin extractors first (scoped to this plugin)
  let extracted = null;
  if (plugin.extractors && plugin.extractors.length > 0) {
    for (const extractor of plugin.extractors) {
      if (extractor.domains.some((d: string) => link.url.includes(d))) {
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
    return extracted.map((e: any) => {
      const finalType = e.type || link.type || (e.url.includes('.m3u8') ? 'hls' : e.url.includes('.mp4') ? 'mp4' : '');
      return {
        ...e,
        url: `/api/stream?url=${encodeURIComponent(e.url)}&referer=${encodeURIComponent(e.referer || link.url)}&type=${finalType}`
      };
    });
  } else {
    const finalType = link.type || (link.url.includes('.m3u8') ? 'hls' : link.url.includes('.mp4') ? 'mp4' : '');
    return [{
      ...link,
      url: `/api/stream?url=${encodeURIComponent(link.url)}&referer=${encodeURIComponent(link.referer || link.url)}&type=${finalType}`
    }];
  }
}
