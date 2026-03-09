const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://megaflix.lat';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Ação', path: '/genero/acao' },
      { name: 'Animação', path: '/genero/animacao' },
      { name: 'Comédia', path: '/genero/comedia' }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(`${mainUrl}${section.path}/1`, {
          headers: { 'User-Agent': USER_AGENT },
          cookies: { 'ordem': '3' }
        });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.col-lg-2 > a').each((i, el) => {
          const title = $(el).find('h3.title').text().trim();
          const href = $(el).attr('href');
          const poster = $(el).find('picture img').attr('data-src') || $(el).find('img').attr('data-src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: href.includes('filme') ? 'Movie' : 'TvSeries',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error in MegaFlix section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/procurar/${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.col-lg-2 > a').each((i, el) => {
      const title = $(el).find('h3.title').text().trim();
      const href = $(el).attr('href');
      const poster = $(el).find('img').attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: href.includes('filme') ? 'Movie' : 'TvSeries',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('h1.h3.mb-1').text().trim();
    const plot = $('p.fs-sm.text-muted').first().text().trim();
    const rating = $('div.text-imdb > span').text().trim();
    const year = $('li.list-inline-item').first().text().trim();
    const poster = $('img.img-fluid').attr('src');
    const isSeries = !url.includes('filme');

    const episodes = [];
    if (isSeries) {
      // Lógica de temporadas via API
      const seasonInfo = [];
      $('div.card-season div.accordion-item div.select-season').each((i, el) => {
        const season = $(el).attr('data-season');
        const item = $(el).attr('data-item');
        if (season && item) seasonInfo.push({ season, item });
      });

      const itemIdMatch = url.match(/\/assistir\/([^/]+)/);
      const itemId = itemIdMatch ? itemIdMatch[1] : null;

      if (itemId) {
        for (const s of seasonInfo) {
          try {
            const apiRes = await axios.post(`${mainUrl}/api/seasons`, new URLSearchParams({
              season: s.season,
              item_id: s.item,
              item_url: itemId
            }));
            const s$ = cheerio.load(apiRes.data);
            s$('div.card-episode').each((j, epEl) => {
              const epA = $(epEl).find('a.episode');
              const epName = $(epEl).find('a.name').text().trim();
              const epHref = epA.attr('href');
              const epNumMatch = epA.text().match(/(\d+)/);

              if (epHref) {
                episodes.push({
                  name: epName || `Episódio ${epNumMatch?.[1]}`,
                  url: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`,
                  episode: parseInt(epNumMatch?.[1]) || (j + 1),
                  season: parseInt(s.season),
                  data: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`
                });
              }
            });
          } catch (e) { }
        }
      }
    } else {
      // No filme, pegamos os players da lista
      const players = [];
      $('ul.players li a').each((i, el) => {
        players.push($(el).attr('data-url'));
      });
      return {
        name: title,
        url,
        type: 'Movie',
        posterUrl: poster,
        plot,
        score: parseFloat(rating),
        year: parseInt(year),
        dataUrl: JSON.stringify(players)
      };
    }

    return {
      name: title,
      url,
      type: 'TvSeries',
      posterUrl: poster,
      plot,
      score: parseFloat(rating),
      year: parseInt(year),
      episodes
    };
  },

  async loadLinks(data) {
    if (data.includes('[') && data.includes(']')) {
      try {
        const urls = JSON.parse(data);
        return urls.map(u => ({ name: 'MegaFlix Mirror', url: u }));
      } catch (e) { }
    }
    return [{ name: 'MegaFlix Player', url: data }];
  }
};
