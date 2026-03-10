import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const mainUrl = 'https://animesonline.cloud';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let persistedCookies: string | null = null;
let isInitialized = false;

// Poster search state (simulating the Kotlin locker/turn logic)
let requestCounter = 0;

/**
 * Helper to fetch a poster from Kitsu or Jikan APIs.
 * Reproduces the rotational logic from the Kotlin version.
 */
async function getPoster(api: any, title: string | null): Promise<string | null> {
  if (!title) return null;
  const cleanTitle = title.replace(/^(Home|Animes|Filmes|Online)\s+/i, '')
    .replace(/(Dublado|Legendado|Online|HD|TV|Todos os Episódios|Filme|\d+ª Temporada|\d+ª|Completo|\d+$)/gi, '')
    .trim();

  const turn = requestCounter % 9;
  const useKitsu = (turn === 1 || turn === 2 || turn === 4 || turn === 5 || turn === 7 || turn === 8);
  requestCounter++;

  try {
    if (useKitsu) {
      const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanTitle)}`;
      const res = await api.request.get(url, { timeout: 10000 });
      const match = JSON.stringify(res.data).match(/posterImage[^}]*original":"(https:[^"]+)"/);
      if (match) return match[1].replace(/\\\//g, '/');
    } else {
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`;
      const res = await api.request.get(url, { timeout: 10000 });
      const match = JSON.stringify(res.data).match(/large_image_url":"(https:[^"]+)"/);
      if (match) return match[1].replace(/\\\//g, '/');
    }
  } catch (e) {
    // Silently fail poster fetch
  }
  return null;
}

async function ensureInitialized(api: any) {
  if (isInitialized) return;
  try {
    const res = await api.request.get(mainUrl, { headers: { 'User-Agent': USER_AGENT } });
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      persistedCookies = cookies.map((c: string) => c.split(';')[0]).join('; ');
    }
    isInitialized = true;
  } catch (e) {
    // Proceed even if cookie init fails
  }
}

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    await ensureInitialized(api);
    const sections = [
      { name: 'Dublados', path: 'tipo/dublado' },
      { name: 'Legendados', path: 'tipo/legendado' }
    ];

    const homeData: HomeSection[] = [];
    for (const section of sections) {
      try {
        const res = await api.request.get(`${mainUrl}/${section.path}`, {
          headers: { 'User-Agent': USER_AGENT, 'Cookie': persistedCookies || '', 'Referer': mainUrl }
        });
        const $ = api.html.parse(res.data);
        const items: MediaItem[] = [];

        const elements = $('div.items article, div.content div.items article');
        for (const el of elements.get()) {
          const titleEl = $(el).find('div.data h3 a');
          const title = titleEl.text().trim();
          const href = titleEl.attr('href');
          if (!title || !href) continue;

          const scoreText = $(el).find('div.rating').text().trim();
          const score = parseFloat(scoreText) || null;
          const poster = await getPoster(api, title);

          items.push({
            name: title,
            url: href,
            type: 'TvSeries', // Default for this source
            posterUrl: poster || '',
            score
          });
        }

        if (items.length > 0) {
          homeData.push({ name: section.name, list: items });
        }
      } catch (e: any) {
        console.error(`Error fetching home section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query: string): Promise<MediaItem[]> {
    await ensureInitialized(api);
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await api.request.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': persistedCookies || '', 'Referer': mainUrl }
    });
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    const elements = $('div.search-page div.result-item article');
    for (const el of elements.get()) {
      const a = $(el).find('div.details div.title a');
      const title = a.text().trim();
      const href = a.attr('href');
      if (!title || !href) continue;

      const yearText = $(el).find('div.meta span.year').text().trim();
      const poster = await getPoster(api, title);

      results.push({
        name: title,
        url: href,
        type: 'TvSeries',
        posterUrl: poster || '',
        year: parseInt(yearText) || null
      });
    }

    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    await ensureInitialized(api);
    const res = await api.request.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': persistedCookies || '', 'Referer': mainUrl }
    });
    const $ = api.html.parse(res.data);

    const title = $('h1').first().text().trim();
    const plot = $('div.wp-content p:nth-child(2)').text().trim() || $('div.wp-content').text().trim();
    const poster = $('div.g-item a').attr('href')?.trim() || '';

    const scoreValue = parseFloat($('b#repimdb strong').text()) || null;
    const durationText = $('div.custom_fields span.valor').filter((_i, el) => $(el).parent().text().includes('Duração')).text().trim();

    const isMovie = url.includes('/filme/') || $('div#episodes').length === 0;
    const type = isMovie ? 'Movie' : 'TvSeries';

    const tags: string[] = [];
    // Could extract more tags if needed

    if (isMovie) {
      return {
        name: title,
        url,
        type,
        posterUrl: poster,
        plot,
        score: scoreValue,
        duration: parseInt(durationText) || null,
        dataUrl: url
      };
    } else {
      const episodes: Episode[] = [];
      $('div#episodes ul.episodios li').each((_i, el) => {
        const epA = $(el).find('div.episodiotitle a');
        const epUrl = epA.attr('href');
        const epName = epA.text().trim();
        const numText = $(el).find('div.numerando').text();
        const match = numText.match(/(\d+)\s*-\s*(\d+)/);

        if (epUrl) {
          episodes.push({
            name: epName,
            season: match ? parseInt(match[1]) : 1,
            episode: match ? parseInt(match[2]) : 1,
            data: epUrl
          });
        }
      });

      return {
        name: title,
        url,
        type,
        posterUrl: poster,
        plot,
        score: scoreValue,
        duration: parseInt(durationText) || null,
        episodes
      };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    // Data is the episode URL
    try {
      const res = await api.request.get(data, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': persistedCookies || '', 'Referer': mainUrl }
      });
      const $ = api.html.parse(res.data);
      const playerOptions = $('ul#playeroptionsul li.dooplay_player_option');
      const finalLinks: StreamLink[] = [];

      for (const option of playerOptions.get()) {
        const type = $(option).attr('data-type');
        const post = $(option).attr('data-post');
        const nume = $(option).attr('data-nume');
        const title = $(option).find('span.title').text().trim();

        if (title.toLowerCase().includes('mobile') || title.toLowerCase().includes('celular')) continue;

        if (type && post && nume) {
          const ajaxUrl = `${mainUrl}/wp-json/dooplayer/v2/${post}/${type}/${nume}`;
          try {
            const ajaxRes = await api.request.get(ajaxUrl, {
              headers: { 'User-Agent': USER_AGENT, 'Referer': data }
            });
            const embedMatch = JSON.stringify(ajaxRes.data).match(/"embed_url":"([^"]+)"/);
            if (embedMatch) {
              const embedUrl = embedMatch[1].replace(/\\\//g, '/').replace(/\\/g, '');

              // Logic for direct mp4/m3u8 from index.php?source=
              const sourceMatch = embedUrl.match(/source=([^&]+)/);
              if (sourceMatch && (embedUrl.includes('.mp4') || embedUrl.includes('.m3u8'))) {
                const directUrl = decodeURIComponent(sourceMatch[1]);
                finalLinks.push({
                  name: `AnimesCloud ${title}`,
                  url: directUrl,
                  quality: 'Auto',
                  referer: mainUrl
                });
              } else {
                // Otherwise return the embed for general extractors
                finalLinks.push({
                  name: `AnimesCloud ${title}`,
                  url: embedUrl,
                  quality: 'Auto'
                });
              }
            }
          } catch (e) {
            // Skip failed ajax
          }
        }
      }
      return finalLinks;
    } catch (e: any) {
      console.error('Error fetching links', e.message);
      return [];
    }
  }
}));
