// @ts-ignore
import { addonBuilder, serveHTTP } from 'stremio-addon-sdk';
import { TMDB } from '../utils/tmdb';
import { PluginRegistry } from './pluginRegistry';
import os from 'os';

const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

const networkAddress = getLocalIp();
const hostname = os.hostname().toLowerCase() + '.local';
const serverPort = process.env.PORT || 3001;
const serverBaseUrl = `http://${networkAddress}:${serverPort}`;

const manifest = {
    id: 'org.cloudstreamweb.addon',
    version: '1.0.0',
    name: 'Cloud S Web',
    description: 'Extensão local para busca de filmes e séries via Plugins CS Web',
    resources: ['catalog', 'stream', 'meta'],
    types: ['movie', 'series', 'anime'],
    catalogs: [
        {
            type: 'series',
            id: 'cs_animes',
            name: 'CSW - Animes - Últimos Episódios'
        },
        {
            type: 'movie',
            id: 'cs_netcine',
            name: 'CSW - NetCine - Últimas Atualizações'
        },
        {
            type: 'movie',
            id: 'cs_overflix',
            name: 'CSW - OverFlix - Filmes e Séries'
        },
        {
            type: 'movie',
            id: 'cs_topfilmes',
            name: 'CSW - TopFilmes - Recém Adicionados'
        },
        {
            type: 'movie',
            id: 'cs_ultracine',
            name: 'CSW - UltraCine - Lançamentos'
        }
    ],
    idPrefixes: ['tmdb:', 'tt', 'csweb:']
};

const builder = new addonBuilder(manifest);

// --- Catalog Handler ---
builder.defineCatalogHandler(async (args: any) => {
    const { type, id, extra } = args;
    const query = extra?.search;

    // 1. Lógica de Busca (TMDB)
    if (query) {
        try {
            let results;
            if (type === 'movie') results = await TMDB.searchMovies(query);
            else results = await TMDB.searchTVShows(query);

            return {
                metas: results.results.map((item: any) => ({
                    id: `tmdb:${item.id}`,
                    type: type,
                    name: item.title || item.name,
                    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                    description: item.overview,
                    releaseInfo: (item.release_date || item.first_air_date || '').substring(0, 4)
                }))
            };
        } catch (e) { return { metas: [] }; }
    }

    // 2. Lógica de Catálogos por Plugin (Home)
    const pluginMapping: Record<string, string> = {
        'cs_animes': 'animesdigital',
        'cs_netcine': 'netcine',
        'cs_overflix': 'overflix',
        'cs_topfilmes': 'topfilmes',
        'cs_ultracine': 'ultracine'
    };

    const pluginId = pluginMapping[id];
    if (pluginId) {
        try {
            const plugin = PluginRegistry.getById(pluginId);
            if (!plugin) return { metas: [] };

            const homeSections = await plugin.getHome();
            if (!homeSections || homeSections.length === 0) return { metas: [] };

            // Pegamos a primeira seção (geralmente lançamentos)
            const list = homeSections[0].list;

            return {
                metas: list.map(item => ({
                    id: `csweb:${pluginId}:${Buffer.from(item.url).toString('base64')}`,
                    type: type,
                    name: item.name,
                    poster: item.posterUrl,
                    description: `Disponível via ${plugin.name}`
                }))
            };
        } catch (err) {
            console.error(`[Stremio] Erro no plugin ${pluginId}:`, err);
        }
    }

    return { metas: [] };
});

// --- Meta Handler ---
builder.defineMetaHandler(async (args: any) => {
    const { id } = args;
    
    if (id.startsWith('csweb:')) {
        const [_, pluginId, encodedUrl] = id.split(':');
        const url = Buffer.from(encodedUrl, 'base64').toString();
        
        try {
            const plugin = PluginRegistry.getById(pluginId);
            if (!plugin) return { meta: null };

            const details = await plugin.load(url);
            return {
                meta: {
                    id: id,
                    type: details.type === 'TvSeries' ? 'series' : 'movie',
                    name: details.name,
                    poster: details.posterUrl,
                    description: details.plot,
                    year: details.year,
                    genres: details.tags
                }
            };
        } catch (err) {
            return { meta: null };
        }
    }

    return { meta: null };
});

// --- Stream Handler ---
builder.defineStreamHandler(async (args: any) => {
    const { type, id } = args;
    
    // 1. Suporte a itens dos catálogos customizados (csweb:)
    if (id.startsWith('csweb:')) {
        const [_, pluginId, encodedUrl] = id.split(':');
        const url = Buffer.from(encodedUrl, 'base64').toString();
        
        const resolverUrl = `${serverBaseUrl}/api/tmdb/resolve?pluginId=${encodeURIComponent(pluginId)}&url=${encodeURIComponent(url)}`;
        return {
            streams: [{
                name: `[CS Web]`,
                title: `Assistir diretamente via Plugin`,
                url: resolverUrl
            }]
        };
    }

    // 2. Suporte a IDs do IMDB (ttXXXX) e TMDB (tmdb:XXXX)
    const isImdb = id.startsWith('tt');
    const cleanId = isImdb ? id : id.replace('tmdb:', '');
    const parts = cleanId.split(':');
    const mainId = parts[0];
    const season = parts[1];
    const episode = parts[2];

    try {
        let details;
        
        if (isImdb) {
            // Se for IMDB, precisamos encontrar o ID do TMDB primeiro
            const findResult = await TMDB.findByExternalId(mainId);
            const tmdbItem = type === 'movie' ? findResult.movie_results[0] : findResult.tv_results[0];
            
            if (!tmdbItem) {
                console.warn(`[Stremio] Item não encontrado no TMDB para o IMDB ID: ${mainId}`);
                return { streams: [] };
            }
            
            // Agora pegamos os detalhes completos do TMDB
            if (type === 'movie') {
                details = await TMDB.getMovieDetails(tmdbItem.id);
            } else {
                details = await TMDB.getTVShowDetails(tmdbItem.id);
            }
        } else {
            // Se já for TMDB ID
            if (type === 'movie') {
                details = await TMDB.getMovieDetails(parseInt(mainId));
            } else {
                details = await TMDB.getTVShowDetails(parseInt(mainId));
            }
        }

        let title = details.title || details.name;
        const year = (details.release_date || details.first_air_date || '').substring(0, 4);

        if (type === 'series' && season && episode) {
            title = `${title} S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`;
        }

        console.log(`[Stremio] Buscando streams para: ${title} (${year})`);

        // 2. Pesquisar em todos os plugins
        const plugins = PluginRegistry.getAll();
        const allStreams: any[] = [];

        for (const plugin of plugins) {
            try {
                const searchResults = await plugin.search(title);
                
                // Tenta encontrar o item exato (mesmo nome ou similar)
                const match = searchResults.find(r => 
                    r.name.toLowerCase().includes(title.toLowerCase()) || 
                    title.toLowerCase().includes(r.name.toLowerCase())
                );

                if (match) {
                    console.log(`[Stremio] Plugin ${plugin.name} encontrou: ${match.name} | URL: ${match.url}`);
                    
                    // URL de resolução tardia - muito mais rápido!
                    const resolverUrl = `${serverBaseUrl}/api/tmdb/resolve?pluginId=${encodeURIComponent(plugin.id)}&url=${encodeURIComponent(match.url)}`;

                    allStreams.push({
                        name: `[CS Web]`,
                        title: `${title}\nAssistir via ${plugin.name}`,
                        url: resolverUrl
                    });
                }
            } catch (err: any) {
                console.error(`[Stremio] Erro no plugin ${plugin.name}:`, err.message);
            }
        }

        return { streams: allStreams };
    } catch (error) {
        console.error('[Stremio] Erro ao buscar streams:', error);
        return { streams: [] };
    }
});

export const initStremioAddon = () => {
    const addonInterface = builder.getInterface();
    serveHTTP(addonInterface, { port: 7000 });
    console.log(`[Stremio] Addon Local:    http://localhost:7000/manifest.json`);
    console.log(`[Stremio] Addon Rede IP: http://${networkAddress}:7000/manifest.json`);
    console.log(`[Stremio] Addon Host:    http://${hostname}:7000/manifest.json`);
};
