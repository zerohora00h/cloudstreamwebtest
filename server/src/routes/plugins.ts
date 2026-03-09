import { Request, Response, Router } from 'express';
import { ExtractorManager } from '../core/extractorManager';
import { PluginRegistry } from '../core/pluginRegistry';

export const pluginRoutes = Router();

pluginRoutes.get('/plugins', (_req: Request, res: Response) => {
  res.json(PluginRegistry.getManifests());
});

pluginRoutes.get('/plugins/:id/home', async (req: Request, res: Response) => {
  try {
    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const data = await plugin.getHome();
    res.json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
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

    const plugin = PluginRegistry.getById(req.params.id as string);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

    const data = await plugin.load(url);
    res.json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
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

      console.log(`[Extractor] Trying: ${link.url}`);
      const extracted = await ExtractorManager.extract(link.url);

      if (extracted && extracted.length > 0) {
        for (const e of extracted) {
          console.log(`[Extractor] Extracted: ${e.url}`);
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
