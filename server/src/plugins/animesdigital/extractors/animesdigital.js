const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'AnimesDigital',
  domains: ['animesdigital.org', 'anivideo.net'],

  async extract(url) {
    try {
      if (url.includes('anivideo.net') && url.includes('d=')) {
        const decodedUrl = decodeURIComponent(url.split('d=')[1].split('&')[0]);
        return [{
          name: 'Player FHD',
          url: decodedUrl,
          type: 'm3u8',
          quality: '1080p'
        }];
      }

      if (url.includes('animesdigital.org/aHR0')) {
        // Base64 decoding logic
        const base64Part = url.split('animesdigital.org/')[1].split('/')[0];
        const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
        // This would usually lead to another page or player
        return [{ name: 'AnimesDigital External', url: decoded }];
      }

      return null;
    } catch (e) {
      return null;
    }
  }
};
