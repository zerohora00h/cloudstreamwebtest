const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'GoFlix',
  domains: ['goflixy.lol', 'fembed.sx', 'bysevepoin.com', 'bysevepoin.in'],

  async extract(url) {
    try {
      const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

      let embedUrl = url;
      if (!url.includes('fembed.sx/e/')) {
        const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        embedUrl = $('div.player-wrap iframe#player').attr('src');
      }

      if (embedUrl) {
        // A lógica do Fembed no original é complexa e requer cookies específicos.
        // Tentaremos retornar o embed para que extratores globais lidem com ele.
        return [{
          name: 'GoFlix Video',
          url: embedUrl,
          quality: 'Auto'
        }];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
