const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'DonghuaNoSekai',
  domains: ['donghuanosekai.com'],

  async extract(url) {
    try {
      // O original Kotlin usa WebViewResolver para interceptar m3u8.
      // Em Node, tentaremos buscar a URL diretamente ou via regex se estiver no HTML.
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': url
        }
      });

      const html = res.data;
      // Busca simples por m3u8 no script/html
      const m3u8Match = html.match(/https?:\/\/[^\s"'<>|]+\.m3u8[^\s"'<>|]*/);

      if (m3u8Match) {
        return [{
          name: 'Donghua HLS',
          url: m3u8Match[0],
          type: 'm3u8',
          referer: url
        }];
      }

      return null;
    } catch (e) {
      console.error('[DonghuaNoSekai Extractor] Error:', e.message);
      return null;
    }
  }
};
