import { createPlugin } from '@plugin-api';
import type { HomeSection, MediaDetails, MediaItem, StreamLink, Episode } from '@shared/types';

const NETCINE_URL = 'https://nnn1.lat';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const defaultHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'cookie': 'XCRF=XCRF; PHPSESSID=v8fk5egon2jcqo69hs7d9cail1',
    'user-agent': USER_AGENT
};

export default createPlugin((api) => {
    function fixUrl(url: string | undefined): string {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('/')) return `${NETCINE_URL}${url}`;
        return `${NETCINE_URL}/${url}`;
    }

    function parseMediaItem($: any, el: any): MediaItem | null {
        const title = $(el).find('h2').text().trim();
        const href = $(el).find('a').attr('href');
        let poster = $(el).find('img').attr('data-src');
        if (!poster) poster = $(el).find('img').attr('src');
        
        if (!title || !href) return null;

        return {
            name: title,
            url: fixUrl(href),
            type: 'Movie',
            posterUrl: fixUrl(poster)
        };
    }

    return {
        async getHome(): Promise<HomeSection[]> {
            const categories = [
                { path: "category/ultimos-filmes", name: "Últimas Atualizações Filmes" },
                { path: "category/acao", name: "Ação" },
                { path: "category/animacao", name: "Animação" },
                { path: "category/aventura", name: "Aventura" },
                { path: "category/comedia", name: "Comédia" },
                { path: "category/crime", name: "Crime" },
                { path: "tvshows", name: "Últimas Atualizações Séries" },
                { path: "tvshows/category/acao", name: "Séries de Ação" },
                { path: "tvshows/category/animacao", name: "Séries de Animação" }
            ];

            const sections: HomeSection[] = [];

            const promises = categories.map(async (cat) => {
                try {
                    const res = await api.request.get(`${NETCINE_URL}/${cat.path}`, { headers: defaultHeaders });
                    const $ = api.html.parse(res.data);
                    const list: MediaItem[] = [];
                    
                    $('#box_movies > div.movie').each((_: any, el: any) => {
                        const item = parseMediaItem($, el);
                        if (item) {
                            if (cat.path.includes('tvshows')) item.type = 'TvSeries';
                            list.push(item);
                        }
                    });

                    if (list.length > 0) {
                        return { name: cat.name, list };
                    }
                } catch (e) {
                    // Ignore fail fetch
                }
                return null;
            });

            const results = await Promise.all(promises);
            for (const res of results) {
                if (res) sections.push(res);
            }

            return sections;
        },

        async search(query: string): Promise<MediaItem[]> {
            try {
                const res = await api.request.get(`${NETCINE_URL}/?s=${encodeURIComponent(query)}`, { headers: defaultHeaders });
                const $ = api.html.parse(res.data);
                const list: MediaItem[] = [];

                $('#box_movies > div.movie').each((_: any, el: any) => {
                    const item = parseMediaItem($, el);
                    if (item) {
                        if (item.url.includes('tvshows')) item.type = 'TvSeries';
                        list.push(item);
                    }
                });

                return list;
            } catch (e) {
                return [];
            }
        },

        async load(url: string): Promise<MediaDetails> {
            const res = await api.request.get(url, { headers: defaultHeaders });
            const $ = api.html.parse(res.data);
            const isTv = url.includes("tvshows") || url.includes("/episode/");

            let title = $('div.dataplus h1').text().trim();
            if (!title) title = $('div.dataplus span.original').text().trim();

            const poster = fixUrl($('div.headingder > div.cover').attr('data-bg'));
            const plot = $('#dato-2 p').text().trim();
            const yearStr = $('#dato-1 > div:nth-child(5)').text().trim();
            const year = parseInt(yearStr, 10);
            const scoreStr = $('div.rank').text().trim();
            const score = parseFloat(scoreStr);

            const recommendations: MediaItem[] = [];
            $('div.links a').each((_: any, el: any) => {
                const recTitle = $(el).find('h4').text().trim();
                const recHref = $(el).attr('href');
                let recPoster = $(el).find('img').attr('src');
                
                if (recTitle && recHref) {
                    recommendations.push({
                        name: recTitle,
                        url: fixUrl(recHref),
                        type: 'Movie',
                        posterUrl: fixUrl(recPoster)
                    });
                }
            });

            let episodes: Episode[] | undefined;
            let seasons: number[] | undefined;

            if (isTv) {
                episodes = [];
                const seasonsMap = new Set<number>();

                $('div.post #cssmenu > ul li > ul > li').each((_: any, el: any) => {
                    const epHref = $(el).find('a').attr('href');
                    const dateText = $(el).find('a > span.datex').text().trim();
                    const name = $(el).find('a > span.datix').text().trim();

                    if (epHref) {
                        const seasonStr = (dateText.split('-')[0] || '').replace(/\D/g, '');
                        const episodeStr = (dateText.split('-')[1] || '').replace(/\D/g, '');
                        
                        const season = parseInt(seasonStr, 10);
                        const episodeNum = parseInt(episodeStr, 10);

                        if (!isNaN(season)) seasonsMap.add(season);

                        episodes!.push({
                            name: name || `Episódio ${episodeNum}`,
                            season: isNaN(season) ? 1 : season,
                            episode: isNaN(episodeNum) ? 1 : episodeNum,
                            data: fixUrl(epHref)
                        });
                    }
                });

                if (episodes.length === 0) {
                    seasonsMap.add(1);
                    episodes.push({
                        name: title || 'Episódio Único',
                        season: 1,
                        episode: 1,
                        data: url
                    });
                }

                seasons = Array.from(seasonsMap).sort((a, b) => a - b);
            }

            return {
                name: title,
                url,
                type: isTv ? 'TvSeries' : 'Movie',
                posterUrl: poster,
                plot: plot || undefined,
                year: isNaN(year) ? undefined : year,
                score: isNaN(score) ? undefined : score,
                dataUrl: !isTv ? url : undefined,
                episodes,
                seasons,
                recommendations
            };
        },

        async loadLinks(data: string): Promise<StreamLink[]> {
            const sessionHeaders = { ...defaultHeaders, 'referer': `${NETCINE_URL}/` };
            const res = await api.request.get(data, { headers: sessionHeaders });
            const html = res.data;

            const links: StreamLink[] = [];

            const labelsMap: Record<string, string> = {};
            for (const match of html.matchAll(/<a\s+href="#(play-\d+)">([^<]+)<\/a>/g)) {
                labelsMap[match[1]] = match[2].trim();
            }

            const iframes: { id: string, url: string }[] = [];
            for (const match of html.matchAll(/<div\s+id="(play-\d+)"[^>]*>.*?<iframe\s+src="([^"]+)/gs)) {
                iframes.push({ id: match[1], url: fixUrl(match[2]) });
            }

            if (iframes.length === 0) return [];

            // Sort dubs first
            iframes.sort((a, b) => {
                const aDub = (labelsMap[a.id] || '').toLowerCase().includes('dub');
                const bDub = (labelsMap[b.id] || '').toLowerCase().includes('dub');
                if (aDub && !bDub) return -1;
                if (!aDub && bDub) return 1;
                return 0;
            });

            for (const iframe of iframes) {
                const label = labelsMap[iframe.id] || 'Player';
                const iframeUrl = iframe.url;

                try {
                    const reqHeaders = { ...sessionHeaders, 'referer': data };
                    const res2 = await api.request.get(iframeUrl, { headers: reqHeaders });
                    const html2 = res2.data;

                    let videoUrl = /<source\s+[^>]*src=["']([^"']+)["']/i.exec(html2)?.[1];
                    let ref = data;

                    if (!videoUrl) {
                        // Try specific player PHP patterns first, then fallback to any media-player PHP link
                        let nextPathMatch = /href\s*=\s*["']([^"']*(?:hls\.php|hlsarchive\.php|gc\d+\.php|playerarchive\.php|playermono\.php|openload[^"']*\.php)[^"']*)["']/i.exec(html2);
                        if (!nextPathMatch) {
                            nextPathMatch = /href\s*=\s*["']([^"']*media-player[^"']*\.php[^"']*)["']/i.exec(html2);
                        }
                        if (!nextPathMatch) {
                            // Last resort: grab any .php href that looks like a player
                            nextPathMatch = /href\s*=\s*["']([^"']*(?:player|dist|players)[^"']*\.php[^"']*)["']/i.exec(html2);
                        }
                        if (nextPathMatch) {
                            const path = nextPathMatch[1];
                            const absNextUrl = fixUrl(path);

                            const res3 = await api.request.get(absNextUrl, {
                                headers: {
                                    ...sessionHeaders,
                                    'referer': iframeUrl,
                                    'cookie': 'XCRF=XCRF; PHPSESSID=3o6atiuojr31rthqvefimlhtl8'
                                }
                            });
                            videoUrl = /<source\s+[^>]*src=["']([^"']+)["']/i.exec(res3.data)?.[1];
                            if (!videoUrl) {
                                // Also try to find video URL in JS variables
                                videoUrl = /(?:file|source|src)\s*[:=]\s*["'](https?:[^"']+(?:\.m3u8|\.mp4)[^"']*)["']/i.exec(res3.data)?.[1];
                            }
                            ref = iframeUrl;
                        }
                    }

                    if (videoUrl) {
                        const isM3u = videoUrl.includes('.m3u8') || videoUrl.includes('.php');
                        links.push({
                            name: `NetCine ${label}`,
                            url: videoUrl,
                            quality: 'Auto',
                            type: isM3u ? 'hls' : 'mp4',
                            referer: ref
                        });
                    }
                } catch (e) {
                    console.error("Error fetching iframe", iframe.url, e);
                }
            }

            return links;
        }
    };
});
