const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'OverFlix',
  domains: ['overflix.me'],

  async extract(url) {
    try {
      const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
      const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
      const $ = cheerio.load(res.data);

      const links = [];
      // Procura players em iframes ou botões
      $('iframe[src*="embed"], iframe[src*="player"]').each((i, el) => {
        const src = $(el).attr('src');
        if (src) links.push({ name: 'OverFlix Embed', url: src, quality: 'Auto' });
      });

      return links.length > 0 ? links : null;
    } catch (e) {
      return null;
    }
  }
};
