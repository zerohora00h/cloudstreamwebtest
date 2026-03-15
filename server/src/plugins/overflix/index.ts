import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const BASE_URL = "https://www.overflix.me";
const LANG = "pt-br";
const UA_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36" };
const OPTIONS_API = "https://fshd.link/api/options";
const PLAYER_API = "https://fshd.link/api/players";
const AJAX_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "application/json"
};

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const categories = [
      { url: "/filmes/acao", name: "Filmes - Ação" },
      { url: "/series/action-and-adventure", name: "Séries - Ação" },
      { url: "/filmes/animacao", name: "Filmes - Animação" },
      { url: "/series/animacao", name: "Séries - Animação" },
      { url: "/filmes/comedia", name: "Filmes - Comédia" },
      { url: "/series/comedia", name: "Séries - Comédia" }
    ];

    const sections: HomeSection[] = [];

    for (const cat of categories) {
      try {
        const url = `${BASE_URL}${cat.url}`;
        const res = await api.request.get(url, { headers: UA_HEADERS });
        const $ = api.html.parse(res.data);
        const list: MediaItem[] = [];

        $('article[class*="group/item"]').each((_, el) => {
          const $el = $(el);
          const link = $el.find('a').attr('href');
          if (!link) return;

          let title = $el.find('h2').text() || $el.find('img').attr('alt')?.replace(" poster", "");
          if (!title) return;

          const isMovie = link.includes('/filme/');
          const type = isMovie ? 'Movie' : 'TvSeries';

          let posterUrl = $el.find('img').attr('src') || "";
          if (posterUrl.includes("transparent") || posterUrl.trim() === "") {
            posterUrl = $el.find('img').attr('data-src') || "";
          }

          let backdropUrl = $el.find('figure img.aspect-video').attr('src') || "";
          if (backdropUrl) {
            backdropUrl = backdropUrl.replace('/w300/', '/original/').replace('/w1280/', '/original/');
          }

          const backdrop = isMovie && backdropUrl ? backdropUrl : null;
          const dataUrl = backdrop ? `${link}|BACKDROP|${backdrop}` : link;

          list.push({
            name: title.trim(),
            url: dataUrl,
            type: type,
            posterUrl: posterUrl,
          });
        });

        if (list.length > 0) {
          sections.push({ name: cat.name, list });
        }
      } catch (err) {
        // Ignorar erros na promise all ou cat iterativo
      }
    }

    return sections;
  },

  async search(query: string): Promise<MediaItem[]> {
    const url = `${BASE_URL}/pesquisa?s=${encodeURIComponent(query)}`;
    const res = await api.request.get(url, { headers: UA_HEADERS });
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    // The Kotlin code uses CSS selector: article.relative.group\/item
    $('article.relative.group\\/item, article[class*="group/item"]').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href');
      if (!link) return;

      let title = $el.find('h2').text() || $el.find('img').attr('alt')?.replace(" poster", "");
      if (!title) return;

      const isMovie = link.includes('/filme/');
      const type = isMovie ? 'Movie' : 'TvSeries';

      let posterUrl = $el.find('img').attr('src') || "";
      if (posterUrl.includes("transparent") || posterUrl.trim() === "") {
        posterUrl = $el.find('img').attr('data-src') || "";
      }

      let backdropUrl = $el.find('figure img.aspect-video').attr('src') || "";
      if (backdropUrl) {
        backdropUrl = backdropUrl.replace('/w300/', '/original/').replace('/w1280/', '/original/');
      }

      const yearText = $el.find('div.text-subs span').filter((_i, e) => !!$(e).text().match(/\d+/)).text();
      const year = yearText ? parseInt(yearText) : undefined;

      const backdrop = isMovie && backdropUrl ? backdropUrl : null;
      const dataUrl = backdrop ? `${link}|BACKDROP|${backdrop}` : link;

      results.push({
        name: title.trim(),
        url: dataUrl,
        type: type,
        posterUrl: posterUrl,
        year: year
      });
    });

    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    const parts = url.split('|BACKDROP|');
    const realUrl = parts[0];
    const forcedBackdrop = parts.length > 1 ? parts[1] : null;

    const res = await api.request.get(realUrl, { headers: UA_HEADERS });
    const $ = api.html.parse(res.data);

    const isMovie = realUrl.includes('/filme/');
    const title = $('h1.text-3xl, h2.text-3xl').first().text().trim() || "";

    const actorsText: string[] = []; // We can add actors to tags

    let poster = "";
    if (isMovie && forcedBackdrop) {
      poster = forcedBackdrop;
    } else {
      poster = $('img[src*="w1280"]').attr('src')?.replace('w1280', 'original') || $('article img').first().attr('src') || "";
    }

    let plot = $('div.text-subs.md\\:text-lg').text().trim() || $('div.text-subs').text().trim();

    let yearText = $('span').filter((_i, e) => !!$(e).text().match(/\d{4}/)).first().text();
    let year = yearText ? parseInt(yearText.match(/\d{4}/)![0]) : undefined;

    let durationText = $('span').filter((_i, e) => $(e).text().includes('minutos')).first().text();
    let duration = durationText ? parseInt(durationText.match(/(\d+)/)?.[1] || "0") : undefined;
    if (duration === 0) duration = undefined;

    let scoreText = $('span.text-main').first().text();
    let score = scoreText ? parseFloat(scoreText) : undefined;

    if (isMovie) {
      return {
        name: title,
        url: realUrl,
        type: 'Movie',
        posterUrl: poster,
        plot: plot,
        year: year,
        duration: duration,
        score: score,
        dataUrl: realUrl
      };
    } else {
      const episodes: Episode[] = [];
      const seasonNumbers: number[] = [];

      $('div[id^="season-"]').each((_, seasonEl) => {
        const idStr = $(seasonEl).attr('id') || "";
        const sNumStr = idStr.replace('season-', '');
        const seasonNumber = (parseInt(sNumStr) || 0) + 1;

        if (!seasonNumbers.includes(seasonNumber)) seasonNumbers.push(seasonNumber);

        $(seasonEl).find('article').each((_i, epEl) => {
          const $ep = $(epEl);
          const epLink = $ep.find('a').attr('href') || "";
          const epName = $ep.find('h2').text() || `Episódio ${_i + 1}`;

          let epNumMatch = $ep.find('span.text-main').text().match(/E(\d+)/);
          const epNum = epNumMatch ? parseInt(epNumMatch[1]) : (_i + 1);

          const epDesc = $ep.find('div.line-clamp-2.text-xs').text().trim();
          const epPoster = $ep.find('img').attr('src');

          if (epLink) {
            episodes.push({
              name: epName,
              season: seasonNumber,
              episode: epNum,
              data: epLink
            });
          }
        });
      });

      return {
        name: title,
        url: realUrl,
        type: 'TvSeries',
        posterUrl: poster,
        plot: plot,
        year: year,
        duration: duration,
        score: score,
        seasons: seasonNumbers,
        episodes: episodes
      };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    // Porting the OverFlixExtractor logic
    const finalLinks: StreamLink[] = [];

    try {
      // 1. Extract Iframe
      const docRes = await api.request.get(data, { headers: UA_HEADERS });
      const $doc = api.html.parse(docRes.data);
      let iframeUrl = $doc('iframe[src*="/filme/"], iframe[src*="/v/"], iframe[src*="/serie/"]').attr('src')
        || $doc('div.aspect-video iframe').attr('src');

      if (!iframeUrl) return [];
      if (iframeUrl.startsWith('//')) iframeUrl = `https:${iframeUrl}`;

      const isTv = data.includes('/episodio/') || iframeUrl.includes('/serie/');
      const contentType = isTv ? "2" : "1";

      const embedRes = await api.request.get(iframeUrl, { headers: { Referer: data } });
      const $embed = api.html.parse(embedRes.data);
      const embedHtml = embedRes.data;

      let contentInfo = "";
      if (isTv) {
        contentInfo = $embed('.episodeOption.active').attr('data-contentid') || "";
        if (!contentInfo) {
          const match = embedHtml.match(/var\s+CONTENT_INFO\s*=\s*'(\d+)';/);
          contentInfo = match ? match[1] : "";
        }
      } else {
        const match = embedHtml.match(/var\s+CONTENT_INFO\s*=\s*'(\d+)';/);
        contentInfo = match ? match[1] : "";
      }

      if (!contentInfo) {
        const parts = iframeUrl.split('?')[0].split('/');
        contentInfo = parts[parts.length - 1];
      }

      const serverIds: string[] = [];

      if (isTv) {
        try {
          const optsRes = await api.request.post(OPTIONS_API, {
            content_id: parseInt(contentInfo) || 0,
            content_type: "2"
          }, {
            headers: { ...AJAX_HEADERS, Referer: iframeUrl }
          });

          const strData = typeof optsRes.data === 'string' ? optsRes.data : JSON.stringify(optsRes.data);
          const idMatches = strData.matchAll(/["']ID["']\s*:\s*(\d+)/g);
          for (const match of idMatches) {
            serverIds.push(match[1]);
          }
        } catch (e) { }
      } else {
        $embed('div.server-selector, .audio-selector').each((_, el) => {
          const dataId = $embed(el).attr('data-id');
          if (dataId) serverIds.push(dataId);
        });
      }

      // Distinct
      const uniqueIds = Array.from(new Set(serverIds));

      for (const videoId of uniqueIds) {
        try {
          const pRes = await api.request.post(PLAYER_API, {
            content_info: parseInt(contentInfo) || 0,
            content_type: contentType,
            video_id: parseInt(videoId) || 0
          }, {
            headers: { "X-Requested-With": "XMLHttpRequest", Referer: iframeUrl }
          });

          const strPData = typeof pRes.data === 'string' ? pRes.data : JSON.stringify(pRes.data);
          const vMatch = strPData.match(/["']video_url["']\s*:\s*["'](.*?)["']/);
          if (!vMatch) continue;

          let playerUrl = vMatch[1].replace(/\\\//g, '/');

          // A API FSHD devolve o link criptografado em base64 em alguns casos (como filmes)
          if (!playerUrl.startsWith('http') && !playerUrl.startsWith('//')) {
            try {
              const decoded = Buffer.from(playerUrl, 'base64').toString('utf-8');
              if (decoded.trim().startsWith('{')) {
                const json = JSON.parse(decoded);
                if (json.url) playerUrl = json.url;
              } else {
                playerUrl = decoded;
              }
            } catch (e) { }
          }

          const pageRes = await api.request.get(playerUrl, { headers: { Referer: iframeUrl } });
          
          // Captura a URL final após redirecionamentos HTTP (302) do Axios
          let finalUrl = (pageRes as any).request?.res?.responseUrl || (pageRes as any).request?.responseURL || playerUrl;

          const locMatch = pageRes.data.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
          if (locMatch) {
            finalUrl = locMatch[1];
            if (finalUrl.startsWith('//')) finalUrl = `https:${finalUrl}`;
            if (finalUrl.startsWith('/')) {
              const u = new URL(playerUrl);
              finalUrl = `${u.origin}${finalUrl}`;
            }
          }

          // Ignorar links de legenda/redirecionadores inúteis como short.icu
          if (finalUrl.includes('short.icu')) continue;

          if (finalUrl.includes('112234152.xyz') || finalUrl.includes('/player/')) {
            finalLinks.push({
              name: "Fsplay / Embed",
              url: finalUrl,
              quality: "Auto",
              referer: playerUrl
            });
          } else {
            finalLinks.push({
              name: "Embed Player",
              url: finalUrl,
              quality: "Auto",
              referer: playerUrl
            });
          }
        } catch (e) { }
      }
    } catch (e: any) {
      console.error('OverFlix extractor error:', e.message);
    }

    return finalLinks;
  }
}));
