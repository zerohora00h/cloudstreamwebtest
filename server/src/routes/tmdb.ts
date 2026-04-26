import { Router } from 'express';
import { TMDB } from '../utils/tmdb';
import { PluginRegistry } from '../core/pluginRegistry';
import { ExtractorManager } from '../core/extractorManager';

const router = Router();

// Cache simples para evitar resoluções duplicadas (HEAD + GET do Stremio)
const resolutionCache = new Map<string, { url: string, expires: number }>();

router.get('/tmdb/search', async (req, res) => {
    const { query, type } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        let results;
        if (type === 'tv') {
            results = await TMDB.searchTVShows(query as string);
        } else {
            results = await TMDB.searchMovies(query as string);
        }
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

router.get('/tmdb/resolve', async (req, res) => {
    const { pluginId, url: itemUrl } = req.query;
    const cacheKey = `${pluginId}:${itemUrl}`;

    // Verifica cache (válido por 5 minutos)
    const cached = resolutionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        return res.redirect(cached.url);
    }

    console.log(`[SmartResolver] Início: Plugin=${pluginId} | URL=${itemUrl}`);

    try {
        const plugin = PluginRegistry.getById(pluginId as string);

        if (!plugin) {
            console.error(`[SmartResolver] Plugin não encontrado: ${pluginId}`);
            return res.status(404).send('Plugin not found');
        }

        // Primeiro carregamos os detalhes para obter o dataUrl correto (Link do Player)
        console.log(`[SmartResolver] Carregando detalhes (plugin.load)...`);
        const details = await plugin.load(itemUrl as string);
        const playerUrl = details.dataUrl || itemUrl as string;
        
        console.log(`[SmartResolver] Buscando links do player: ${playerUrl}`);
        const rawLinks = await plugin.loadLinks(playerUrl);
        console.log(`[SmartResolver] loadLinks retornou ${rawLinks?.length || 0} resultados.`);

        if (!rawLinks || rawLinks.length === 0) {
            console.warn(`[SmartResolver] Plugin ${plugin.name} não retornou nenhum link para esta URL.`);
            return res.status(404).send('No links found');
        }

        // Loop de Fallback: Tenta cada link disponível no plugin
        for (const link of rawLinks) {
            try {
                let videoUrl = link.url;
                let referer = link.referer || playerUrl; // Usa o playerUrl como referer padrão
                let type = link.type || (link.url.includes('.m3u8') ? 'hls' : 'mp4');

                console.log(`[SmartResolver] Tentando extrair de: ${link.name} | URL: ${videoUrl}`);

                // Tenta extrair o vídeo real
                const extracted = await ExtractorManager.extract(link.url);
                if (extracted && extracted.length > 0) {
                    videoUrl = extracted[0].url;
                    referer = extracted[0].referer || link.url;
                    type = extracted[0].type || (videoUrl.includes('.m3u8') ? 'hls' : 'mp4');
                    console.log(`[SmartResolver] Extrator DEVOLVEU: ${videoUrl}`);
                } else {
                    console.log(`[SmartResolver] Sem extrator para ${link.name}, usando link original.`);
                }

                // Construímos a URL absoluta para o nosso proxy de stream (OBRIGATÓRIO)
                const host = req.get('host');
                const protocol = req.protocol;
                const finalProxiedUrl = `${protocol}://${host}/api/stream?url=${encodeURIComponent(videoUrl)}&referer=${encodeURIComponent(referer)}&type=${type}`;
                
                // Salva no cache
                resolutionCache.set(cacheKey, { url: finalProxiedUrl, expires: Date.now() + 5 * 60 * 1000 });

                console.log(`[SmartResolver] Redirecionando Stremio para: ${finalProxiedUrl}`);
                return res.redirect(finalProxiedUrl);
            } catch (e: any) {
                console.warn(`[SmartResolver] Falha no link ${link.name}: ${e.message}. Tentando próximo...`);
                continue;
            }
        }

        res.status(404).send('Could not resolve any playable link');
    } catch (error: any) {
        console.error('[SmartResolver] Erro crítico:', error.message);
        res.status(500).send('Internal server error');
    }
});

export const tmdbRoutes = router;
