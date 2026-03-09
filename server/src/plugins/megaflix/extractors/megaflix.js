const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'MegaFlix',
  domains: ['megaflix.lat', 'megafrixapi.com'],

  async extract(url) {
    try {
      const cleanUrl = url.replace('https://megafrixapi.com/blog/index.php?link=', '');
      return [{
        name: 'MegaFlix FHD',
        url: cleanUrl,
        quality: '1080p'
      }];
    } catch (e) {
      return null;
    }
  }
};
