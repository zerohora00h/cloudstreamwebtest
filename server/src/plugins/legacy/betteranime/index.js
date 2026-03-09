const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://betteranime.io';

module.exports = {
  async getHome() {
    const categories = [
      { id: 'acao', name: 'Ação', path: 'categorias/acao' },
      { id: 'aventura', name: 'Aventura', path: 'categorias/aventura' },
      { id: 'fantasia', name: 'Fantasia', path: 'categorias/fantasia' },
      { id: 'misterio', name: 'Mistério', path: 'categorias/misterio' }
    ];

    const homeData = [];
    for (const cat of categories) {
      try {
        const res = await axios.get(`${mainUrl}/${cat.path}`);
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.items.full article.item.tvshows').each((i, el) => {
          const titleEl = $(el).find('div.data h3 a');
          const href = titleEl.attr('href');
          const title = titleEl.text().trim();
          const poster = $(el).find('div.poster img').attr('src');

          if (href && title) {
            items.push({
              name: title,
              url: href,
              type: 'TvSeries',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) {
          homeData.push({ name: cat.name, list: items });
        }
      } catch (e) {
        console.error(`Error in BetterAnime category ${cat.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.content.rigth.csearch div.result-item article').each((i, el) => {
      const titleEl = $(el).find('div.details div.title a');
      const href = titleEl.attr('href');
      const title = titleEl.text().trim();
      const poster = $(el).find('div.image div.thumbnail img').attr('src');
      const year = parseInt($(el).find('div.details div.meta span.year').text().trim());

      if (href && title) {
        results.push({
          name: title,
          url: href,
          type: (href.includes('/filme/') || href.includes('/movie/')) ? 'Movie' : 'TvSeries',
          posterUrl: poster,
          year: year || null
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    const title = $('div.sheader div.data h1').text().trim();
    const description = $('div.wp-content p').text().trim();
    const poster = $('div.sheader div.poster img').attr('src');
    const hasEpisodes = $('#episodes').length > 0;

    const episodes = [];
    if (hasEpisodes) {
      $('div#episodes div.se-c div.se-a ul.episodios li').each((i, el) => {
        const aTag = $(el).find('div.episodiotitle a');
        const epUrl = aTag.attr('href');
        const epTitle = aTag.text().trim();
        const epImg = $(el).find('div.contentImg').attr('data-thumb') || $(el).find('img').attr('src');

        if (epUrl) {
          episodes.push({
            name: epTitle,
            url: epUrl,
            data: epUrl,
            posterUrl: epImg
          });
        }
      });
    }

    return {
      name: title,
      url,
      type: hasEpisodes ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot: description,
      episodes
    };
  },

  async loadLinks(data) {
    return [{ name: 'BetterAnime Player', url: data }];
  }
};
