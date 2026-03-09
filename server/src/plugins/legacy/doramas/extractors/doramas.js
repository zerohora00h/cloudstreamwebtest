const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'Doramas',
  domains: ['doramasonline.co', 'seriesboa.live', 'embedplay.upns', 'embedplay.upn.one'],

  async extract(url) {
    try {
      if (url.includes('seriesboa.live/episodio/')) {
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const links = [];

        // Extrai data-source de botões
        $('button[data-source]').each((i, el) => {
          const src = $(el).attr('data-source');
          if (src && !src.includes('playembedapi')) {
            links.push({ name: `Mirror ${i + 1}`, url: src });
          }
        });

        // Extrai iframes
        $('div#player iframe, div.play-overlay iframe').each((i, el) => {
          const src = $(el).attr('src');
          if (src && !src.includes('playembedapi')) {
            links.push({ name: `Iframe ${i + 1}`, url: src });
          }
        });

        return links.length > 0 ? links : null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
