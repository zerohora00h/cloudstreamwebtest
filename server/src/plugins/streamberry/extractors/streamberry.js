const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'Streamberry',
  domains: ['streamberry.com.br', 'filemoon.to'],

  async extract(url) {
    try {
      let finalUrl = url;
      // Resolve redirecionamento se necessário (baseado na lógica Kotlin)
      if (url.includes('/links/')) {
        const res = await axios.get(url, { maxRedirects: 0, validateStatus: null });
        if (res.headers.location) finalUrl = res.headers.location;
      }

      if (finalUrl.includes('filemoon.to')) {
        return [{
          name: 'Streamberry FileMoon',
          url: finalUrl,
          quality: 'Auto'
        }];
      } else {
        // Se não for filemoon, tenta procurar no HTML
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const filemoonLink = $('.fix-table tr').filter((i, el) => $(el).find('img[src*="filemoon.to"]').length > 0).find('a').attr('href');
        if (filemoonLink) {
          return [{ name: 'Streamberry FileMoon', url: filemoonLink, quality: 'Auto' }];
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
