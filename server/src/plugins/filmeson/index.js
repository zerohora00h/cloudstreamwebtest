const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://filmeson1.site';

module.exports = {
  async getHome() {
    const genres = [
      { name: 'Ação', path: 'genero/acao' },
      { name: 'Aventura', path: 'genero/aventura' },
      { name: 'Comédia', path: 'genero/comedia' },
      { name: 'Terror', path: 'genero/terror' }
    ];

    const homeData = [];
    for (const genre of genres) {
      try {
        const res = await axios.get(`${mainUrl}/${genre.path}/`);
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.items.full article.item').each((i, el) => {
          const title = $(el).find('div.data h3 a').text().trim();
          const href = $(el).find('div.data h3 a').attr('href');
          const poster = $(el).find('div.poster img').attr('src')?.replace('w185', 'original');

          if (title && href) {
            items.push({
              name: title,
              url: href,
              type: href.includes('/series/') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) {
          homeData.push({ name: genre.name, list: items });
        }
      } catch (e) {
        console.error(`Error in FilmesOn genre ${genre.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.result-item article').each((i, el) => {
      const title = $(el).find('div.details div.title a').text().trim();
      const href = $(el).find('div.details div.title a').attr('href');
      const poster = $(el).find('div.image img').attr('src')?.replace('/w92/', '/original/');

      if (title && href) {
        results.push({
          name: title,
          url: href,
          type: href.includes('/series/') ? 'TvSeries' : 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    const title = $('h1').first().text().trim();
    const poster = $('div.poster img').attr('src');
    const plot = $('div.wp-content blockquote p').text().trim();
    const isSeries = url.includes('/series/');

    const episodes = [];
    if (isSeries) {
      $('div#serie_contenido div.se-c').each((i, seasonEl) => {
        const seasonNum = $(seasonEl).find('span.se-t').text().trim();
        $(seasonEl).find('ul.episodios li').each((j, epEl) => {
          const epLink = $(epEl).find('div.episodiotitle a');
          const epUrl = epLink.attr('href');
          const epName = epLink.text().trim();
          const epNum = $(epEl).find('div.numerando').text().split('-').pop()?.trim();

          if (epUrl) {
            episodes.push({
              name: epName,
              url: epUrl,
              episode: parseInt(epNum) || 1,
              season: parseInt(seasonNum) || 1,
              data: epUrl
            });
          }
        });
      });
    }

    return {
      name: title,
      url,
      type: isSeries ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot,
      episodes: episodes.length > 0 ? episodes : (isSeries ? [] : undefined),
      dataUrl: isSeries ? undefined : url
    };
  },

  async loadLinks(data) {
    return [{ name: 'FilmesOn Player', url: data }];
  }
};
