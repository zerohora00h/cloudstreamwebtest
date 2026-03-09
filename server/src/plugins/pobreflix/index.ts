import { createPlugin } from '@plugin-api';
import type { HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const BASE_URL = 'https://www.pobreflixtv.club';
const CURRENT_YEAR = new Date().getFullYear();

const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const homeGenres = [
  { name: `Filmes - ${CURRENT_YEAR}`, url: `${BASE_URL}/genero/filmes-de-${CURRENT_YEAR}-online-66/` },
  { name: `Séries - ${CURRENT_YEAR}`, url: `${BASE_URL}/genero/series-de-${CURRENT_YEAR}-online-83/` },
  { name: 'Filmes - Ação', url: `${BASE_URL}/genero/filmes-de-acao-online-3/` },
  { name: 'Séries - Ação', url: `${BASE_URL}/genero/series-de-acao-online-22/` },
  { name: 'Filmes - Comédia', url: `${BASE_URL}/genero/filmes-de-comedia-online-4/` },
  { name: 'Séries - Netflix', url: `${BASE_URL}/genero/series-de-netflix-online-44/` }
];

function fixUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const homeData: HomeSection[] = [];
    for (const genre of homeGenres) {
      try {
        const res = await api.request.get(genre.url, { headers: defaultHeaders });
        const $ = api.html.parse(res.data);
        const list: MediaItem[] = [];

        $('div.vbItemImage').each((_i, el) => {
          const title = $(el).find('div.caption').text().replace(/[\n\r]+/g, ' ').trim();
          let link = $(el).find('a').first().attr('href');
          if (!title || !link) return;
          link = fixUrl(link);

          const container = $(el).find('div.vb_image_container');
          let poster = container.attr('data-background-src') || '';
          if (!poster) {
            const style = container.attr('style') || '';
            const match = style.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) {
              poster = match[1].replace(/&quot;/g, '').replace(/"/g, '');
            }
          }
          if (poster) {
            poster = poster.replace('w185', 'original');
            poster = fixUrl(poster);
          }

          const isSeries = genre.name.toLowerCase().includes('série');

          list.push({
            name: title,
            url: link,
            type: isSeries ? 'TvSeries' : 'Movie',
            posterUrl: poster || ''
          });
        });

        if (list.length > 0) {
          homeData.push({ name: genre.name, list });
        }
      } catch (err: any) {
        console.error(`Erro ao buscar gênero ${genre.name} no PobreFlix:`, err.message);
      }
    }
    return homeData;
  },

  async search(query: string): Promise<MediaItem[]> {
    const url = `${BASE_URL}/pesquisar/?p=${encodeURIComponent(query.replace(/ /g, '+'))}`;
    try {
      const res = await api.request.get(url, { headers: defaultHeaders });
      const $ = api.html.parse(res.data);
      const results: MediaItem[] = [];

      $('div.vbItemImage').each((_i, el) => {
        const title = $(el).find('div.caption').text().replace(/[\n\r]+/g, ' ').trim();
        let link = $(el).find('a').first().attr('href');
        if (!title || !link) return;
        link = fixUrl(link);

        const container = $(el).find('div.vb_image_container');
        let poster = container.attr('data-background-src') || '';
        if (!poster) {
          const style = container.attr('style') || '';
          const match = style.match(/url\(['"]?(.*?)['"]?\)/);
          if (match) {
            poster = match[1].replace(/&quot;/g, '').replace(/"/g, '');
          }
        }
        if (poster) {
          poster = poster.replace('w185', 'original');
          poster = fixUrl(poster);
        }

        const isSeries = link.includes('serie') || link.includes('temporada');

        results.push({
          name: title,
          url: link,
          type: isSeries ? 'TvSeries' : 'Movie',
          posterUrl: poster || ''
        });
      });

      return results;
    } catch (e: any) {
      console.error('Erro na busca PobreFlix', e);
      return [];
    }
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url, { headers: defaultHeaders });
    const $ = api.html.parse(res.data);

    const isSeries = $('span.escolha_span').length > 0;
    const title = $('h1.ipsType_pageTitle span.titulo').text().replace(/[\n\r]+/g, ' ').trim() || 'Sem título';

    const plotEl = $('div.sinopse').clone();
    plotEl.find('span#myBtn').remove();
    plotEl.find('b').remove();
    const plot = plotEl.text().replace(/\.\.\./g, '').trim();

    let duration: number | null = null;
    $('div.infos span').each((_i, el) => {
      const text = $(el).text();
      if (text.includes('min')) {
        duration = parseInt(text.replace('min', '').trim()) || null;
      }
    });

    const scoreText = $('div.infos span.imdb').first().text().replace('/10', '').trim();
    const score = parseFloat(scoreText) || null;

    const yearText = $('div.infos span').eq(1).text();
    const year = parseInt(yearText) || null;

    const tags: string[] = [];
    $('span.gen a').each((_i, el) => {
      tags.push($(el).text().trim());
    });

    let posterUrl = '';
    let playerUrl = isSeries
      ? $('div.listagem li a').first().attr('href')
      : (url.includes('?') ? `${url}&area=online` : `${url}/?area=online`);

    if (playerUrl) {
      playerUrl = fixUrl(playerUrl);
      try {
        const styleRes = await api.request.get(playerUrl, { headers: defaultHeaders });
        const $style = api.html.parse(styleRes.data);
        const style = $style('div#video_embed').attr('style') || '';
        const match = style.match(/url\((.*?)\)/);
        if (match) {
          posterUrl = match[1].replace(/['"]/g, '').replace('w1280', 'original');
          posterUrl = fixUrl(posterUrl);
        }
      } catch (_e) { /* ignore */ }
    }

    if (!posterUrl) {
      const fallback = $('div.vb_image_container').attr('data-background-src');
      if (fallback) {
        posterUrl = fixUrl(fallback.replace('w185', 'original'));
      }
    }

    if (isSeries) {
      const seasonsSet = new Set<number>();
      $('script').each((_i, el) => {
        const data = $(el).html();
        if (data && data.includes('DOMContentLoaded')) {
          const regex = /<li onclick='load\((\d+)\);'>/g;
          let match;
          while ((match = regex.exec(data)) !== null) {
            seasonsSet.add(parseInt(match[1]));
          }
        }
      });

      const episodes: { name: string; season: number; episode: number; data: string }[] = [];
      for (const season of Array.from(seasonsSet)) {
        const seasonUrl = url.includes('?') ? `${url}&temporada=${season}` : `${url}?temporada=${season}`;
        try {
          const seasonRes = await api.request.get(seasonUrl, { headers: defaultHeaders });
          const $s = api.html.parse(seasonRes.data);
          $s('div.listagem li').each((_i, ep) => {
            const href = $s(ep).find('a').first().attr('href');
            const dataId = $s(ep).attr('data-id') || '';
            const epIdStr = dataId.replace(new RegExp(`^${season}`), '');
            const epNum = parseInt(epIdStr) || 0;

            if (href) {
              episodes.push({
                season,
                episode: epNum,
                name: `Episódio ${epNum}`,
                data: `series|${fixUrl(href)}`
              });
            }
          });
        } catch (_e) { /* ignore */ }
      }

      return { name: title, url, type: 'TvSeries', posterUrl, plot, year, tags, score, duration, episodes };
    } else {
      return {
        name: title, url, type: 'Movie', posterUrl, plot, year, tags, score, duration,
        dataUrl: `movie|${url}`
      };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    const [type, rawUrl] = data.split('|', 2);
    const actualUrl = rawUrl || data;

    let url = actualUrl;
    if (type === 'movie') {
      url = actualUrl.includes('?') ? `${actualUrl}&area=online` : `${actualUrl}/?area=online`;
    }

    try {
      const res = await api.request.get(url, { headers: defaultHeaders });
      const $ = api.html.parse(res.data);
      const finalLinks: StreamLink[] = [];
      const BASE_PLAYER = `${BASE_URL}/e/getplay.php`;

      const playItems = $('div.item[onclick*="C_Video"]').get();

      for (const item of playItems) {
        const onClick = $(item).attr('onclick') || '';
        const match = onClick.match(/C_Video\('(\d+)','(.*?)'\)/);

        if (match) {
          const id = match[1];
          const server = match[2].toLowerCase();
          const playUrl = `${BASE_PLAYER}?id=${id}&sv=${server}`;

          try {
            const playRes = await api.request.get(playUrl, {
              headers: { ...defaultHeaders, Referer: url }
            });

            const requestObj = (playRes as any).request?.res?.responseUrl;
            const finalPlayUrl: string | undefined = requestObj;

            if (finalPlayUrl && finalPlayUrl !== playUrl && !finalPlayUrl.includes('pobreflixtv')) {
              let correctedUrl = finalPlayUrl;
              if (correctedUrl.includes('streamtape.com/v/')) {
                correctedUrl = correctedUrl.replace('/v/', '/e/');
              }

              finalLinks.push({
                name: `PobreFlix - ${server}`,
                url: correctedUrl,
                quality: 'Auto'
              });
            } else {
              const $play = api.html.parse(playRes.data);
              const iframeSrc = $play('iframe').attr('src');
              if (iframeSrc && !iframeSrc.includes('pobreflixtv')) {
                finalLinks.push({
                  name: `PobreFlix - ${server}`,
                  url: iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc,
                  quality: 'Auto'
                });
              }
            }
          } catch (_e) { /* ignore */ }
        }
      }

      return finalLinks;
    } catch (e: any) {
      console.error('Erro no loadLinks PobreFlix', e);
      return [];
    }
  }
}));
