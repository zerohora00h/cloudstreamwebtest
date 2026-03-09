const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'UltraCine',
  domains: ['ultracine.org', 'assistirseriesonline.icu'],

  async extract(url) {
    try {
      const targetUrl = url.match(/^\d+$/) ? `https://assistirseriesonline.icu/episodio/${url}` : url;
      const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(res.data);

      const links = [];
      // Procura data-source em botões ou src em iframes
      $('button[data-source]').each((i, el) => {
        const src = $(el).attr('data-source');
        if (src) links.push({ name: 'UltraCine Source', url: src });
      });

      $('div#player iframe, div.play-overlay iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) links.push({ name: 'UltraCine Embed', url: src });
      });

      return links.length > 0 ? links : null;
    } catch (e) {
      return null;
    }
  }
};
