import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const mainUrl = 'https://ultracine.cloud';

function fixUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (!url.startsWith('http')) return `${mainUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  return url;
}

function parseDuration(text: string | null | undefined): number | null {
  if (!text) return null;
  const matchHm = text.match(/(\\d+)h\\s*(\\d+)m/);
  if (matchHm) {
    return (parseInt(matchHm[1]) * 60) + parseInt(matchHm[2]);
  }
  const matchM = text.match(/(\\d+)m/);
  if (matchM) {
    return parseInt(matchM[1]);
  }
  return null;
}

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const categories = [
      { url: `${mainUrl}/category/lancamentos/`, name: 'Lançamentos' },
      { url: `${mainUrl}/category/acao/`, name: 'Ação' },
      { url: `${mainUrl}/category/animacao/`, name: 'Animação' },
      { url: `${mainUrl}/category/comedia/`, name: 'Comédia' },
      { url: `${mainUrl}/category/terror/`, name: 'Terror' }
    ];

    const homeData: HomeSection[] = [];

    for (const cat of categories) {
      try {
        const res = await api.request.get(cat.url);
        const $ = api.html.parse(res.data);
        const list: MediaItem[] = [];

        $('div.aa-cn div#movies-a ul.post-lst li').each((_i, el) => {
          const title = $(el).find('header.entry-header h2.entry-title').text().trim();
          const href = $(el).find('a.lnk-blk').attr('href');
          if (!title || !href) return;

          let poster = $(el).find('div.post-thumbnail figure img').attr('src') ||
            $(el).find('div.post-thumbnail figure img').attr('data-src');
          if (poster) poster = fixUrl(poster).replace('/w500/', '/original/');

          const year = parseInt($(el).find('span.year').text()) || null;

          let scoreText = $(el).find('div.entry-meta span.vote').text().replace('TMDB', '').trim();
          const score = parseFloat(scoreText) || null;

          list.push({
            name: title,
            url: href,
            type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
            posterUrl: poster || '',
            year,
            score
          });
        });

        if (list.length > 0) {
          homeData.push({ name: cat.name, list });
        }
      } catch (err: any) {
        console.error(`UltraCine - Erro ao carregar home ${cat.name}:`, err.message);
      }
    }

    return homeData;
  },

  async search(query: string): Promise<MediaItem[]> {
    const res = await api.request.get(`${mainUrl}/?s=${encodeURIComponent(query)}`);
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    $('div.aa-cn div#movies-a ul.post-lst li').each((_i, el) => {
      const title = $(el).find('header.entry-header h2.entry-title').text().trim();
      const href = $(el).find('a.lnk-blk').attr('href');
      if (!title || !href) return;

      let poster = $(el).find('div.post-thumbnail figure img').attr('src') ||
        $(el).find('div.post-thumbnail figure img').attr('data-src');
      if (poster) poster = fixUrl(poster).replace('/w500/', '/original/');

      const year = parseInt($(el).find('span.year').text()) || null;
      let scoreText = $(el).find('div.entry-meta span.vote').text().replace('TMDB', '').trim();
      const score = parseFloat(scoreText) || null;

      results.push({
        name: title,
        url: href,
        type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
        posterUrl: poster || '',
        year,
        score
      });
    });

    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url);
    const $ = api.html.parse(res.data);

    const title = $('aside.fg1 header.entry-header h1.entry-title').text().trim();
    let poster = $('div.bghd img.TPostBg').attr('src') || $('div.bghd img.TPostBg').attr('data-src');
    if (poster) poster = fixUrl(poster).replace('/w1280/', '/original/');

    const yearText = $('span.year').first().text().replace(/[^0-9]/g, '');
    const year = parseInt(yearText) || null;

    const durationText = $('span.duration').text();
    const duration = parseDuration(durationText);

    const scoreText = $('div.vote-cn span.vote span.num').text();
    const score = parseFloat(scoreText) || null;

    const plot = $('aside.fg1 div.description p').text().trim();

    const tags: string[] = [];
    $('span.genres a').each((_i, el) => {
      tags.push($(el).text().trim());
    });

    const isSerie = url.includes('/serie/');
    const iframeUrl = $("iframe[src*='assistirseriesonline.icu'], iframe[src*='assistirseriesonline.top']").attr('src');

    if (isSerie) {
      const episodes: Episode[] = [];
      const seasonsSet = new Set<number>();

      if (iframeUrl) {
        try {
          const epRes = await api.request.get(iframeUrl, { headers: { 'Referer': url } });
          const $ep = api.html.parse(epRes.data);

          $ep('ul.header-navigation li[data-season-id]').each((_i, seasonEl) => {
            const seasonNumberStr = $ep(seasonEl).attr('data-season-number');
            const seasonNumber = parseInt(seasonNumberStr || '1');
            const seasonId = $ep(seasonEl).attr('data-season-id');

            seasonsSet.add(seasonNumber);

            $ep(`li[data-season-id='${seasonId}']`).each((_j, epEl) => {
              const epId = $ep(epEl).attr('data-episode-id');
              if (!epId) return;

              const epName = $ep(epEl).find('a').text().trim();
              const epNumberMatch = epName.match(/\\d+/);
              const epNumber = epNumberMatch ? parseInt(epNumberMatch[0]) : 1;

              episodes.push({
                name: epName || `Episódio ${epNumber}`,
                season: seasonNumber,
                episode: epNumber,
                data: epId
              });
            });
          });
        } catch (err: any) {
          console.error("UltraCine Episódios Error:", err.message);
        }
      }

      // Fallback em caso de erro na extração
      if (seasonsSet.size === 0) seasonsSet.add(1);

      return {
        name: title,
        url,
        type: 'TvSeries',
        posterUrl: poster || '',
        plot,
        year,
        tags,
        score,
        duration,
        seasons: Array.from(seasonsSet).sort((a, b) => a - b),
        episodes
      };
    } else {
      return {
        name: title,
        url,
        type: 'Movie',
        posterUrl: poster || '',
        plot,
        year,
        tags,
        score,
        duration,
        dataUrl: iframeUrl || url
      };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    if (!data) return [];

    let targetUrl = data;

    // Se a string recebida for apenas números (data de série)
    if (/^\d+$/.test(data)) {
      targetUrl = `https://assistirseriesonline.icu/episodio/${data}`;
    }
    // Se a string for url completa que contenha números no final
    else if ((data.includes('ultracine.org') || data.includes('ultracine.cloud')) && /^\d+$/.test(data.split('/').pop() || '')) {
      targetUrl = `https://assistirseriesonline.top/episodio/${data.split('/').pop()}`;
    }
    // Se for url bruta da página do filme
    else if (data.includes('ultracine.org') || data.includes('ultracine.cloud')) {
      try {
        const baseRes = await api.request.get(data);
        const $b = api.html.parse(baseRes.data);
        const iframe = $b("iframe[src*='assistirseriesonline.icu'], $b(\"iframe[src*='assistirseriesonline.top']\")").attr('src');
        if (iframe) targetUrl = iframe;
      } catch (e) { }
    }

    try {
      const res = await api.request.get(targetUrl);
      const $ = api.html.parse(res.data);
      const linksOut: StreamLink[] = [];

      // Extrai iframes dos players
      const extractEmbedLinks = (): string[] => {
        const buttons = $('button[data-source]').map((_i, el) => $(el).attr('data-source')).get();
        const iframes = $('div#player iframe, div.play-overlay iframe').map((_i, el) => $(el).attr('src')).get();
        return Array.from(new Set([...buttons, ...iframes])).filter(x => !!x) as string[];
      };

      const embedLinks = extractEmbedLinks();

      for (const link of embedLinks) {
        if (!link) continue;

        // Passa para nossos extratores registrados globalmente ou empurra como raw
        // O servidor lidará com extratores baseados em dominio (embedplay.upns, vidstack) automaticamente.
        linksOut.push({
          name: 'Servidor Externo',
          url: fixUrl(link),
          quality: 'Auto',
          referer: targetUrl
        });
      }

      return linksOut;
    } catch (e: any) {
      console.error("UltraCine Links Error", e.message);
      return [];
    }
  }
}));
