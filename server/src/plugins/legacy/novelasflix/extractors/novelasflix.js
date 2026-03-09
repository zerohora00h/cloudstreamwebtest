const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'NovelasFlix',
  domains: ['novelasflix4k.me'],

  async extract(url) {
    try {
      // O original usa WebViewResolver para capturar m3u8.
      // Em Node, tentaremos buscar a URL no HTML diretamente.
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const html = res.data;
      const m3u8Match = html.match(/https?:\/\/[^\s"'<>|]+\.m3u8[^\s"'<>|]*/);

      if (m3u8Match) {
        return [{
          name: 'Novelas HLS',
          url: m3u8Match[0],
          type: 'm3u8',
          referer: url
        }];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
