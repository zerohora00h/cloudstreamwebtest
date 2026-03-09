const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://animesonline.cloud';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function getPoster(title) {
  if (!title) return null;
  const cleanTitle = title.replace(/(?i)^(Home|Animes|Filmes|Online)\s+/, '')
    .replace(/(?i)(Dublado|Legendado|Online|HD|TV|Todos os Episódios|Filme|\d+ª Temporada|\d+ª|Completo|\d+$)/g, '')
    .trim();

  try {
    // Alternating between Kitsu and Jikan as in the original Kotlin code
    const useKitsu = Math.random() > 0.3;
    if (useKitsu) {
      const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanTitle)}`;
      const res = await axios.get(url, { timeout: 10000 });
      const match = JSON.stringify(res.data).match(/posterImage[^}]*original":"(https:[^"]+)"/);
      if (match) return match[1].replace(/\\\//g, '/');
    } else {
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`;
      const res = await axios.get(url, { timeout: 10000 });
      const match = JSON.stringify(res.data).match(/large_image_url":"(https:[^"]+)"/);
      if (match) return match[1].replace(/\\\//g, '/');
    }
  } catch (e) { }
  return null;
}

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Dublados', url: `${mainUrl}/tipo/dublado` },
      { name: 'Legendados', url: `${mainUrl}/tipo/legendado` }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(section.url, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.items article, div.content div.items article').each((i, el) => {
          const title = $(el).find('div.data h3 a').text().trim();
          const href = $(el).find('div.data h3 a').attr('href');
          if (!title || !href) return;

          items.push({
            name: title,
            url: href,
            type: 'TvSeries',
            posterUrl: null // Will be updated by client or we can try to fetch it
          });
        });

        if (items.length > 0) {
          homeData.push({ name: section.name, list: items });
        }
      } catch (e) {
        console.error(`Error fetching home section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT, 'Referer': mainUrl } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.search-page div.result-item article').each((i, el) => {
      const title = $(el).find('div.details div.title a').text().trim();
      const href = $(el).find('div.details div.title a').attr('href');
      if (!title || !href) return;

      const yearText = $(el).find('div.meta span.year').text().trim();
      results.push({
        name: title,
        url: href,
        type: 'TvSeries',
        year: parseInt(yearText) || null
      });
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT, 'Referer': mainUrl } });
    const $ = cheerio.load(res.data);

    const title = $('h1').first().text().trim();
    const plot = $('div.wp-content p').eq(1).text().trim() || $('div.wp-content').text().trim();
    const poster = $('div.g-item a').attr('href')?.trim();

    const isMovie = url.includes('/filme/') || $('#episodes').length === 0;
    const type = isMovie ? 'Movie' : 'TvSeries';

    const tags = [];
    $('div.custom_fields span.valor').each((i, el) => {
      // Simple tags extraction
      const txt = $(el).text().trim();
      if (txt && txt.length < 20) tags.push(txt);
    });

    if (isMovie) {
      return {
        name: title,
        url,
        type,
        posterUrl: poster,
        plot,
        tags,
        dataUrl: url
      };
    } else {
      const episodes = [];
      $('div#episodes ul.episodios li').each((i, el) => {
        const epUrl = $(el).find('div.episodiotitle a').attr('href');
        const epName = $(el).find('div.episodiotitle a').text().trim();
        const numText = $(el).find('div.numerando').text();
        const match = numText.match(/(\d+)\s*-\s*(\d+)/);

        episodes.push({
          name: epName,
          url: epUrl,
          episode: match ? parseInt(match[2]) : 1,
          season: match ? parseInt(match[1]) : 1,
          data: epUrl
        });
      });

      return {
        name: title,
        url,
        type,
        posterUrl: poster,
        plot,
        tags,
        episodes
      };
    }
  },

  async loadLinks(data) {
    // Delegation to local extractor
    return [{ name: 'AnimesCloud Player', url: data }];
  }
};
