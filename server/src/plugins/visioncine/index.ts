import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const mainUrl = 'https://cnvsweb.stream';

function fixUrl(url: string): string {
  if (!url) return '';
  let fixedUrl = url.trim();

  if (fixedUrl.startsWith('//')) {
    fixedUrl = `https:${fixedUrl}`;
  } else if (!fixedUrl.startsWith('http')) {
    fixedUrl = `${mainUrl}${fixedUrl}`;
  }

  return encodeURI(fixedUrl.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"));
}

const INTERNAL_DRM_ID = "pygrp_KJp_cyHo0.lbp-kBz.mo52lYEgGDK1tDG9tb_9GXI_";

function getAppConfigToken(): string {
  const os = 5;
  const stdArr = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 38, 42];
  const std = stdArr.map(c => String.fromCharCode(c + os)).join("");

  const op = 3;
  const tpArr = [119, 62, 117, 63, 118, 64, 116, 65, 115, 66, 114, 67, 113, 68, 112, 69, 111, 70, 110, 71, 109, 72, 108, 73, 107, 75, 106, 74, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 40, 42, 92, 87, 85, 86, 84, 43, 39, 30, 33, 32, 34, 35];
  const tp = tpArr.map(c => String.fromCharCode(c + op)).join("");

  let sb = "";
  for (const c of INTERNAL_DRM_ID) {
    const i = tp.indexOf(c);
    if (i !== -1 && i < std.length) {
      sb += std[i];
    } else {
      if (c === '!') sb += '+';
      else if (c === '$') sb += '/';
      else sb += c;
    }
  }

  let buffer = sb;
  while (buffer.length % 4 !== 0) buffer += "=";
  return Buffer.from(buffer, 'base64').toString('utf8').trim();
}

function getHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': getAppConfigToken()
  };
}

const homeGenres = [
  { name: 'Populares', id: '207' },
  { name: 'Ação', id: '85' },
  { name: 'Animes', id: '94' },
  { name: 'Séries Netflix', id: '73' }
];

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const homeData: HomeSection[] = [];
    for (const genre of homeGenres) {
      try {
        const url = `${mainUrl}/ajax/genre.php?genre=${genre.id}&page=1`;
        const res = await api.request.get(url, { headers: getHeaders() });

        const list: MediaItem[] = (res.data || []).map((item: any) => {
          const isSeries = item.time?.toLowerCase().includes('temporadas');
          return {
            name: item.title?.replace(/[\n\r]+/g, ' ').trim() || '',
            // Ajuste 1: Rota corrigida para garantir que séries não caiam na lógica de filmes
            url: fixUrl(isSeries ? `/series/${item.slug}` : `/watch/${item.slug}`),
            type: isSeries ? 'TvSeries' : 'Movie',
            posterUrl: item.image ? item.image.replace('/w300/', '/original/') : '',
            year: parseInt(item.release) || null,
            score: parseFloat(item.imdb_rating) || null
          };
        });

        if (list.length > 0) {
          homeData.push({ name: genre.name, list });
        }
      } catch (err: any) {
        console.error(`Erro ao buscar gênero ${genre.name}:`, err.message);
      }
    }
    return homeData;
  },

  async search(query: string): Promise<MediaItem[]> {
    const url = `${mainUrl}/search.php?q=${encodeURIComponent(query)}`;
    const res = await api.request.get(url, { headers: getHeaders() });
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    $('section.listContent .item.poster').each((_i, el) => {
      const a = $(el).find('a.btn.free, a.btn.free.fw-bold').first();
      let href = a.attr('href');
      if (!href) return;
      href = fixUrl(href);

      const title = $(el).find('h6').first().text().replace(/[\n\r]+/g, ' ').trim();
      if (!title) return;

      const style = $(el).find('.content').first().attr('style') || '';
      const match = style.match(/url\((.*?)\)/);
      let img = match ? match[1] : '';
      img = img.replace('/w300/', '/original/');

      const scoreText = $(el).find('span').filter((_i, e) => $(e).text().includes('IMDb')).text();
      const score = parseFloat(scoreText.replace('IMDb', '').trim()) || null;

      const tags = $(el).find('.tags').first().text() || '';
      const yearMatch = tags.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;
      const type = tags.toLowerCase().includes('temporada') ? 'TvSeries' : 'Movie';

      results.push({ name: title, url: href, type, posterUrl: img, year, score });
    });

    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url, { headers: getHeaders() });
    const $ = api.html.parse(res.data);

    const name = $('h1.fw-bolder').first().text().replace(/[\n\r]+/g, ' ').trim();
    const plot = $('p.small.linefive').first().text().trim();
    const yearText = $('p.log span').text();
    const yearMatch = yearText.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    const seasonsElement = $('#seasons-view');
    // Séries podem vir como /series/ ou /watch/, então verificamos o elemento de temporadas também
    const isSerie = url.includes('/series/') || (url.includes('/watch/') && seasonsElement.length > 0);

    const posterStyle = $('.backImage').first().attr('style') || '';
    const posterMatch = posterStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
    const posterUrl = posterMatch ? posterMatch[1].replace('/w300/', '/original/') : '';

    const tags: string[] = [];
    $('.producerInfo p.lineone').each((_i, el) => {
      if ($(el).find('span').first().text().toLowerCase().includes('gênero')) {
        $(el).find('span span').each((_j, span) => {
          tags.push($(span).text().trim());
        });
      }
    });

    const scoreText = $('span').filter((_i, e) => $(e).text().includes('IMDb')).text();
    const score = parseFloat(scoreText.replace('IMDb', '').trim()) || null;

    const durationText = $('span').filter((_i, e) => $(e).text().toLowerCase().includes('min')).text();
    const duration = parseInt(durationText.toLowerCase().replace('min', '').trim()) || null;

    const recommendations: MediaItem[] = [];
    $('div.swiper-slide.item').each((_i, el) => {
      const recTitle = $(el).find('h6').first().text().trim();
      const recHref = $(el).find('div.buttons a').first().attr('href');
      if (!recTitle || !recHref) return;

      const recStyle = $(el).find('div.content').first().attr('style') || '';
      const recPosterMatch = recStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
      const recPoster = recPosterMatch ? recPosterMatch[1].replace('/w300/', '/original/') : '';

      const isRecSeries = $(el).find('div.tags span').filter((_j, e) => $(e).text().toLowerCase().includes('temporada')).length > 0;

      recommendations.push({
        name: recTitle,
        url: fixUrl(recHref),
        type: isRecSeries ? 'TvSeries' : 'Movie',
        posterUrl: recPoster
      });
    });

    if (isSerie) {
      const episodes: Episode[] = [];
      const seasonNumbers: number[] = [];
      const seasonsData: string[] = [];
      
      $('#seasons-view option').each((_i, el) => {
        const val = $(el).attr('value');
        if (val) {
          seasonsData.push(val);
          seasonNumbers.push(_i + 1);
        }
      });

      const extractFromHtml = (htmlContent: string, sNum: number) => {
        const $eps = api.html.parse(htmlContent);
        $eps('div.ep').each((_j, el) => {
          const epNumRaw = $eps(el).find('p').first().text().trim();
          const epNum = parseInt(epNumRaw) || (_j + 1);

          const epName = $eps(el).find('h5').first().text().replace(/[\n\r]+/g, ' ').trim() || `Episódio ${epNum}`;
          const playBtn = $eps(el).find('a[href*="/s/"], a[href*="/m/"]').first();
          let episodeUrl = playBtn.attr('href');

          if (episodeUrl) {
            const fixedEpUrl = episodeUrl.startsWith('http') 
              ? episodeUrl 
              : `http://www.playcnvs.stream${episodeUrl.startsWith('/') ? '' : '/'}${episodeUrl}`;

            episodes.push({
              name: epName,
              episode: epNum,
              season: sNum,
              data: fixedEpUrl
            });
          }
        });
      };

      // Padrão PobreFlix: Carrega temporadas sob demanda se solicitado
      let requestedSeason: number | null = null;
      try {
        const urlParams = new URL(url).searchParams;
        const requested = urlParams.get('requested_season');
        if (requested) requestedSeason = parseInt(requested);
      } catch (e) {}

      if (requestedSeason) {
        // Busca a temporada específica via AJAX
        const idx = requestedSeason - 1;
        if (idx >= 0 && idx < seasonsData.length) {
          try {
            const seasonId = seasonsData[idx];
            const epUrl = `${mainUrl}/ajax/episodes.php?season=${seasonId}&page=1`;
            const epRes = await api.request.get(epUrl, { headers: { ...getHeaders(), Referer: url } });
            
            let htmlData = epRes.data;
            if (typeof htmlData === 'object' && htmlData !== null) {
              htmlData = htmlData.html || JSON.stringify(htmlData);
            }
            extractFromHtml(typeof htmlData === 'string' ? htmlData : epRes.data, requestedSeason);
          } catch (e: any) {
            console.error(`Erro temp ${requestedSeason}:`, e.message);
          }
        }
      } else {
        // Primeiro carregamento: tenta pegar da página (Season 1) ou AJAX da primeira temporada
        extractFromHtml(res.data, 1);
        
        // Se a página não tinha episódios, busca a primeira temporada via AJAX
        if (episodes.length === 0 && seasonsData.length > 0) {
          try {
            const seasonId = seasonsData[0];
            const epUrl = `${mainUrl}/ajax/episodes.php?season=${seasonId}&page=1`;
            const epRes = await api.request.get(epUrl, { headers: { ...getHeaders(), Referer: url } });
            extractFromHtml(epRes.data, 1);
          } catch (e) {}
        }
      }

      return { 
        name, url, type: 'TvSeries', posterUrl, plot, year, tags, score, duration, 
        seasons: seasonNumbers,
        episodes, 
        recommendations 
      };
    } else {
      const watchBtn = $('a[href*="/m/"]').first();
      const dataUrl = watchBtn.attr('href') ? fixUrl(watchBtn.attr('href')!) : url;

      return { name, url, type: 'Movie', posterUrl, plot, year, tags, score, duration, dataUrl, recommendations };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    const episodeUrl = data.startsWith('[') ? data.replace(/^\["?|"?\]$/g, '').split('|').pop()! : data;

    try {
      const baseHeaders = {
        ...getHeaders(),
        'Referer': mainUrl
      };
      const res = await api.request.get(episodeUrl, { headers: baseHeaders });
      const $ = api.html.parse(res.data);
      const sourceUrls: { name: string; url: string }[] = [];

      $('.sources-dropdown a, .dropdown-menu a, .sources-dropdown .dropdown-menu a.source-btn').each((_i, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#')) return;

        let tagTxt = $(el).clone().children().remove().end().text().trim();
        if (!tagTxt) tagTxt = $(el).text().replace($(el).find('label').text(), '').trim();

        const badge = $(el).find('label.badge').text().trim();
        const linkName = badge ? `${tagTxt} (${badge})` : (tagTxt || `Source ${_i + 1}`);

        if (linkName.toLowerCase().includes('premium')) return;

        const abs = href.startsWith('http') ? href : `http://www.playcnvs.stream${href.startsWith('/') ? '' : '/'}${href}`;
        sourceUrls.push({ name: linkName, url: abs });
      });

      const sortedSources = sourceUrls.sort((a, b) => b.name.toLowerCase().includes('4k') ? 1 : -1);
      const finalLinks: StreamLink[] = [];

      const patterns = [
        /initializePlayerWithSubtitle\(['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"],\s*['"]([^'"]*\.srt[^'"]*)['"]/,
        /initializePlayer\(['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /file:\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /src:\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /["']?file["']?\s*:\s*["']([^"']+)["']/,
        /["']?url["']?\s*:\s*["']([^"']+)["']/,
        /videoSources\s*=\s*\[{.*?file:\s*["'](.*?)["']/s
      ];

      for (const source of sortedSources) {
        try {
          const pRes = await api.request.get(source.url, {
            headers: { ...baseHeaders, 'Referer': episodeUrl }
          });

          const $p = api.html.parse(pRes.data);
          const scripts = $p('script').map((_i, el) => $p(el).text()).get().join('\n');

          for (const pat of patterns) {
            const match = scripts.match(pat);
            if (match) {
              const videoUrl = match[1].replace(/\\\//g, '/');
              finalLinks.push({
                name: `VisionCine - ${source.name}`,
                url: videoUrl,
                quality: 'Auto'
              });
              break;
            }
          }
        } catch (e: any) {
          console.error(`Erro ao extrair ${source.name}:`, e.message);
        }
      }

      return finalLinks;
    } catch (e: any) {
      console.error('Error fetching links', e.message);
      return [];
    }
  }
}));