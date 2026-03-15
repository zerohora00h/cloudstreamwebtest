import { createPlugin } from '@plugin-api';
import type { HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const MAIN_URL = "https://www.topfilmes.biz";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const categories = [
      { name: "Ação", url: "/genero/acao" },
      { name: "Animação", url: "/genero/animacao" },
      { name: "Comédia", url: "/genero/comedia" },
      { name: "Ficção Científica", url: "/genero/ficcao-cientifica" },
    ];

    const sections: HomeSection[] = [];

    for (const cat of categories) {
      try {
        const url = `${MAIN_URL}${cat.url}`;
        const res = await api.request.get(url, { headers: { 'User-Agent': USER_AGENT } });
        const $ = api.html.parse(res.data);
        const list: MediaItem[] = [];

        // Try 'div.filmes div.filme' as in Kotlin
        $('div.filmes div.filme').each((_, el) => {
          const $el = $(el);
          let link = $el.prop('tagName') === 'A' ? $el.attr('href') : $el.find('a').attr('href');
          let title = $el.find('div.title').text().trim() || $el.find('h2').text().trim() || $el.find('a').attr('title')?.trim() || $el.find('img').attr('alt')?.trim();
          
          let $img = $el.find('img');
          let posterUrl = $img.attr('data-src') || $img.attr('src') || $img.attr('data-original') || $img.attr('data-ll-src') || "";
          
          let yearText = $el.find('div.year').text() || $el.find('span.year').text() || $el.find('.year').text();
          let year = yearText ? parseInt(yearText) : undefined;
          
          if (link && title) {
            posterUrl = posterUrl.replace("_filter(blur)", "");
            if (posterUrl.startsWith('/')) posterUrl = `${MAIN_URL}${posterUrl}`;
            
            list.push({
              name: title,
              url: link.startsWith('http') ? link : `${MAIN_URL}${link}`,
              type: 'Movie',
              posterUrl: posterUrl,
              year: year
            });
          }
        });

        if (list.length > 0) {
          sections.push({
            name: cat.name,
            list: list
          });
        }
      } catch (e) {
        console.error(`Error loading home section ${cat.name}:`, e);
      }
    }

    return sections;
  },

  async search(query: string): Promise<MediaItem[]> {
    const url = `${MAIN_URL}/busca?q=${encodeURIComponent(query).replace(/%20/g, "+")}`;
    const res = await api.request.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = api.html.parse(res.data);
    const list: MediaItem[] = [];

    let containers = $('div.filmes div.filme');
    if (containers.length === 0) containers = $('div.filme');
    if (containers.length === 0) containers = $('div.card');
    if (containers.length === 0) containers = $('a[href*="/assistir/"]');

    containers.each((_, el) => {
      const $el = $(el);
      let link = $el.prop('tagName') === 'A' ? $el.attr('href') : $el.find('a').attr('href');
      let title = $el.find('div.title').text().trim() || $el.find('h2').text().trim() || $el.find('a').attr('title')?.trim() || $el.find('img').attr('alt')?.trim();
      
      let $img = $el.find('img');
      let posterUrl = $img.attr('data-src') || $img.attr('src') || $img.attr('data-original') || $img.attr('data-ll-src') || "";
      
      let yearText = $el.find('div.year').text() || $el.find('span.year').text() || $el.find('.year').text();
      let year = yearText ? parseInt(yearText) : undefined;
      
      if (link && title) {
        posterUrl = posterUrl.replace("_filter(blur)", "");
        if (posterUrl.startsWith('/')) posterUrl = `${MAIN_URL}${posterUrl}`;
        
        list.push({
          name: title,
          url: link.startsWith('http') ? link : `${MAIN_URL}${link}`,
          type: 'Movie',
          posterUrl: posterUrl,
          year: year
        });
      }
    });

    return list;
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = api.html.parse(res.data);

    const title = $('div.infos h2').text().trim() || "Sem título";
    let posterUrl = $('div.player img').attr('src') || "";
    if (posterUrl.startsWith('/')) posterUrl = `${MAIN_URL}${posterUrl}`;

    let yearText = $('div.infos div.info').eq(0).text().trim();
    let durationText = $('div.infos div.info').eq(1).text().trim();
    let genre = $('div.infos div.info').eq(2).text().trim();
    
    let year = yearText ? parseInt(yearText) : undefined;
    
    // Parse duration: "90 Minutos" -> 90
    let duration = durationText ? parseInt(durationText.replace(/\D/g, '')) : undefined;
    if (isNaN(duration as number)) duration = undefined;

    const plot = $('div.infos div.sinopse').text().trim();
    const scoreText = $('div.infos div.imdb span').text().trim();
    let score = scoreText ? parseFloat(scoreText) : undefined;
    
    const tags: string[] = [];
    if (genre) tags.push(genre);

    let dataUrl = "";
    const players = $('div.links_dub a');
    if (players.length > 0) {
      dataUrl = players.first().attr('href') || "";
      if (dataUrl.startsWith('//')) dataUrl = `https:${dataUrl}`;
    } else {
      const altLinks = $('a[href*="player"]');
      if (altLinks.length > 0) {
        dataUrl = altLinks.first().attr('href') || "";
        if (dataUrl.startsWith('//')) dataUrl = `https:${dataUrl}`;
      }
    }

    return {
      name: title,
      url: url,
      type: 'Movie',
      posterUrl: posterUrl,
      plot: plot,
      year: year,
      tags: tags,
      score: score,
      duration: duration,
      dataUrl: dataUrl
    };
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    if (!data) return [];
    
    let playerUrl = data;
    // Data might be from Kotlin "[url]" format
    if (data.startsWith('[') && data.endsWith(']')) {
      playerUrl = data.substring(1, data.length - 1).split(',')[0].trim().replace(/^"|"$/g, '');
    }

    if (playerUrl.includes('player=')) {
      playerUrl = playerUrl.replace(/player=\d+/, 'player=1');
    }

    if (!playerUrl.startsWith('http')) {
       // if it's a relative path, assume mainUrl
       playerUrl = playerUrl.startsWith('//') ? `https:${playerUrl}` : `${MAIN_URL}${playerUrl.startsWith('/') ? '' : '/'}${playerUrl}`;
    }

    const res = await api.request.get(playerUrl, { headers: { 'User-Agent': USER_AGENT } });
    const $ = api.html.parse(res.data);

    const links: StreamLink[] = [];

    // Check .plyr__video-wrapper
    const videoWrapper = $('div.plyr__video-wrapper');
    if (videoWrapper.length > 0) {
      let src = videoWrapper.find('video#player').attr('src') || videoWrapper.find('source').attr('src');
      if (src) {
        if (src.startsWith('//')) src = `https:${src}`;
        links.push({
          name: "TopFilmes Direct",
          url: src,
          quality: "Auto",
          type: src.includes('.m3u8') ? 'hls' : 'mp4',
          referer: MAIN_URL
        });
        return links;
      }
    }

    // Checking any video
    let anyVideoSrc = $('video').attr('src');
    if (anyVideoSrc) {
       if (anyVideoSrc.startsWith('//')) anyVideoSrc = `https:${anyVideoSrc}`;
        links.push({
          name: "TopFilmes Direct",
          url: anyVideoSrc,
          quality: "Auto",
          type: anyVideoSrc.includes('.m3u8') ? 'hls' : 'mp4',
          referer: MAIN_URL
        });
        return links;
    }

    // Checking source tags
    let sourceSrc = $('source').filter((_, el) => $(el).attr('type') === 'video/mp4' && !!$(el).attr('src')).attr('src');
    if (sourceSrc) {
      if (sourceSrc.startsWith('//')) sourceSrc = `https:${sourceSrc}`;
        links.push({
          name: "TopFilmes Direct",
          url: sourceSrc,
          quality: "Auto",
          type: 'mp4',
          referer: MAIN_URL
        });
        return links;
    }

    return links;
  }
}));
