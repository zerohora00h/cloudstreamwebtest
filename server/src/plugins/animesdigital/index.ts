import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const mainUrl = 'https://animesdigital.org';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/437.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const defaultHeaders = {
  'User-Agent': USER_AGENT,
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01'
};

function fixUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url.startsWith('http') ? url : `${mainUrl}${url}`;
}

async function getSecurityToken(api: any, url: string): Promise<string> {
  try {
    const res = await api.request.get(url);
    const $ = api.html.parse(res.data);
    return $('.menu_filter_box').attr('data-secury') || 'c1deb78cd4';
  } catch (e) {
    return 'c1deb78cd4';
  }
}

async function getAnimesFromAPI(api: any, page: number, requestData: string): Promise<MediaItem[]> {
  const typeUrl = requestData.includes('filmes') ? 'filmes' : (requestData.includes('desenhos') ? 'desenhos' : 'animes');
  const filterAudio = requestData.includes('dublado') ? 'dublado' : (requestData.includes('legendados') ? 'legendado' : '0');

  const token = await getSecurityToken(api, requestData);
  const postData = new URLSearchParams({
    token,
    pagina: page.toString(),
    search: '0',
    limit: '30',
    type: 'lista',
    filters: JSON.stringify({
      filter_data: `filter_letter=0&type_url=${typeUrl}&filter_audio=${filterAudio}&filter_order=name`,
      filter_genre_add: [],
      filter_genre_del: []
    })
  });

  const res = await api.request.post(`${mainUrl}/func/listanime`, postData.toString(), {
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': requestData
    }
  });

  const items: MediaItem[] = [];
  const results = res.data.results || [];

  for (const html of results) {
    const cleanHtml = html.replace(/\\"/g, '"').replace(/\\\//g, '/');
    const $ = api.html.parse(cleanHtml);
    const itemEl = $('.itemA');
    const a = itemEl.find('a');
    const title = itemEl.find('.title_anime').text().trim() || a.attr('title') || '';
    const href = a.attr('href');
    const poster = itemEl.find('img').attr('src');

    if (title && href) {
      items.push({
        name: title,
        url: fixUrl(href),
        type: href.includes('/filme/') ? 'Movie' : 'TvSeries',
        posterUrl: fixUrl(poster || '')
      });
    }
  }

  return items;
}

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const sections = [
      { name: 'Animes - Últimos Episódios', url: `${mainUrl}/home`, isAPI: false },
      { name: 'Animes - Legendados', url: `${mainUrl}/animes-legendados-online`, isAPI: true },
      { name: 'Animes - Dublados', url: `${mainUrl}/animes-dublado`, isAPI: true },
      { name: 'Animes - Filmes', url: `${mainUrl}/filmes`, isAPI: true }
    ];

    const homeData: HomeSection[] = [];
    for (const section of sections) {
      try {
        let items: MediaItem[] = [];
        if (section.isAPI) {
          items = await getAnimesFromAPI(api, 1, section.url);
        } else {
          const res = await api.request.get(section.url);
          const $ = api.html.parse(res.data);
          $('.itemE, .itemA').each((_i, el) => {
            const a = $(el).find('a');
            const title = $(el).find('.title_anime').text().trim() || a.attr('title') || '';
            const href = a.attr('href');
            const poster = $(el).find('img').attr('src');
            if (title && href) {
              items.push({
                name: title,
                url: fixUrl(href),
                type: href.includes('/filme/') ? 'Movie' : 'TvSeries',
                posterUrl: fixUrl(poster || '')
              });
            }
          });
        }
        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error home ${section.name}`, e);
      }
    }
    return homeData;
  },

  async search(query: string): Promise<MediaItem[]> {
    const res = await api.request.get(`${mainUrl}/?s=${encodeURIComponent(query)}`);
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    $('.itemE, .itemA').each((_i, el) => {
      const a = $(el).find('a');
      const title = a.text().trim() || $(el).find('.title_anime').text().trim();
      const href = a.attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

      if (title && href) {
        results.push({
          name: title,
          url: fixUrl(href),
          type: href.includes('/filme/') ? 'Movie' : 'TvSeries',
          posterUrl: fixUrl(poster || '')
        });
      }
    });
    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url);
    const $ = api.html.parse(res.data);

    // If it's a direct video page, we try to find the anime main page
    const isEpisodePage = url.includes('/video/a/');

    const title = $('meta[property="og:title"]').attr('content')?.split(' - ')[0] || $('h1').text().trim();
    const poster = fixUrl($('meta[property="og:image"]').attr('content') || '');
    const plot = $('meta[property="og:description"]').attr('content') || $('.sinopse').text().trim();

    const tags: string[] = [];
    $('.genres a, .generos a').each((_i, el) => { tags.push($(el).text().trim()); });

    const isMovie = url.includes('/filme/');
    const type = isMovie ? 'Movie' : 'TvSeries';

    if (isMovie) {
      return { name: title, url, type, posterUrl: poster, plot, tags, dataUrl: `movie|${url}` };
    }

    const episodes: Episode[] = [];

    // Lógica para carregar episódios (simples, pegando da primeira página)
    $('.item_ep a').each((_i, el) => {
      const epUrl = $(el).attr('href');
      const epName = $(el).find('.title_anime').text().trim() || $(el).find('img').attr('title') || '';
      const epNum = parseInt(epName.match(/(\d+)/)?.[1] || '1');

      if (epUrl) {
        episodes.push({
          name: epName,
          season: 1,
          episode: epNum,
          data: `series|${fixUrl(epUrl)}`
        });
      }
    });

    // Se estiver em uma página de episódio, retorna apenas ele se nada for encontrado
    if (episodes.length === 0 && isEpisodePage) {
      const epNum = parseInt(title.match(/(\d+)/)?.[1] || '1');
      episodes.push({ name: `Episódio ${epNum}`, season: 1, episode: epNum, data: `series|${url}` });
    }

    return {
      name: title,
      url,
      type,
      posterUrl: poster,
      plot,
      tags,
      episodes: episodes.sort((a, b) => b.episode - a.episode)
    };
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    const [type, url] = data.split('|', 2);
    const actualUrl = url || data;

    try {
      const res = await api.request.get(actualUrl);
      const $ = api.html.parse(res.data);
      const links: StreamLink[] = [];

      // Seleciona iframes baseados no tipo (Filme ou Série)
      const iframes = (type === 'series') ? $('.tab-video iframe[src]') : $('iframe[src]');

      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        const src = $(iframe).attr('src');
        if (!src) continue;

        // 1. Caso AniVideo (M3U8 direto no parâmetro 'd')
        if (src.includes('anivideo.net') && src.includes('d=')) {
          try {
            const urlParam = src.split('d=')[1].split('&')[0];
            const hlsUrl = decodeURIComponent(urlParam); // Correção: era URL Encoded, não B64

            links.push({
              name: 'Player FHD (AniVideo)',
              url: hlsUrl,
              quality: '1080p',
              type: 'hls',
              referer: 'https://anivideo.net/'
            });
          } catch (e) { console.error("Erro no decode AniVideo", e); }
        }

        // 2. Caso Base64 do AnimesDigital (Redirecionamento)
        else if (src.includes('animesdigital.org/aHR0')) {
          try {
            // Pega o que está entre 'animesdigital.org/' e a próxima '/'
            const match = src.match(/animesdigital\.org\/([^/]+)/);
            if (match) {
              const decodedUrl = Buffer.from(match[1], 'base64').toString('utf8');
              const playerRes = await api.request.get(decodedUrl);
              const $p = api.html.parse(playerRes.data);

              $p('iframe[src]').each((_j, pIframe) => {
                const pSrc = $p(pIframe).attr('src');
                if (pSrc) {
                  links.push({
                    name: 'Player Alternativo',
                    url: pSrc,
                    quality: 'Auto',
                    referer: 'https://animesdigital.org/'
                  });
                }
              });
            }
          } catch (e) { console.error("Erro no decode B64", e); }
        }

        // 3. Caso Genérico (Mixdrop, Streamtape, etc)
        else if (src.startsWith('http')) {
          links.push({
            name: 'Player Externo',
            url: src,
            quality: 'Auto',
            referer: 'https://animesdigital.org/'
          });
        }
      }

      return links;
    } catch (e) {
      return [];
    }
  }
}));
