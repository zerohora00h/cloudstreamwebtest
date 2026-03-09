const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://embedtvonline.com/';

module.exports = {
  async getHome() {
    try {
      const res = await axios.get(mainUrl);
      const $ = cheerio.load(res.data);
      const items = [];

      $('main.grid div.card').each((i, el) => {
        const title = $(el).find('div.title').text().trim();
        const href = $(el).find('a.thumb').attr('href');
        const img = $(el).find('a.thumb img').attr('src');

        if (title && href) {
          items.push({
            name: title,
            url: href,
            type: 'Live',
            posterUrl: img
          });
        }
      });

      return [{ name: 'Todos os Canais', list: items }];
    } catch (e) {
      console.error('Error fetching EmbedTVOnline home:', e.message);
      return [];
    }
  },

  async search(query) {
    try {
      const res = await axios.get(mainUrl);
      const $ = cheerio.load(res.data);
      const results = [];

      $('main.grid div.card').each((i, el) => {
        const title = $(el).find('div.title').text().trim();
        const href = $(el).find('a.thumb').attr('href');
        const img = $(el).find('a.thumb img').attr('src');

        if (title && href && title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            name: title,
            url: href,
            type: 'Live',
            posterUrl: img
          });
        }
      });

      return results;
    } catch (e) {
      return [];
    }
  },

  async load(url) {
    // Para simplificar, como é ao vivo, o load extrai o nome do componente se possível ou usa fallback
    return {
      name: 'Canal TV',
      url,
      type: 'Live',
      dataUrl: url
    };
  },

  async loadLinks(data) {
    return [{ name: 'TV Online Player', url: data }];
  }
};
