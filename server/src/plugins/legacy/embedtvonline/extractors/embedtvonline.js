const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'EmbedTVOnline',
  domains: ['embedtvonline.com', '1.embedtvonline.com'],

  async extract(url) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0'
        }
      });
      const html = res.data;

      // Busca por m3u8 no script como no Kotlin
      const urlMatch = html.match(/(?:const\s+(?:url|SRC)\s*=\s*(?:q\(['"]src['"],\s*)?['"]([^'"]+\.m3u8[^'"]*)['"])/);
      let finalUrl = urlMatch ? urlMatch[1] : null;

      if (!finalUrl) {
        const regex = /https?:\/\/[^\s"'<>|]+\.m3u8[^\s"'<>|]*/;
        const match = html.match(regex);
        finalUrl = match ? match[0] : null;
      }

      if (finalUrl) {
        return [{
          name: 'EmbedTV Live',
          url: finalUrl,
          type: 'm3u8',
          headers: {
            'referer': 'https://1.embedtvonline.com',
            'origin': 'https://1.embedtvonline.com/'
          }
        }];
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
