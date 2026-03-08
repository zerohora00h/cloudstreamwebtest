const axios = require('axios');
const JsUnpacker = require('../utils/jsUnpacker');

module.exports = {
  name: 'FileMoon',
  domains: ['filemoon.sx', 'filemoon.to', 'filemoon.in', 'filemoon.net', 'bysebuho.com'],

  async extract(url) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = res.data;
      const unpacker = new JsUnpacker(html);
      const unpacked = unpacker.unpack();

      if (!unpacked) return null;

      // Regex for FileMoon video URL in unpacked script: file:"..."
      const fileRegex = /file\s*:\s*["'](.*?\.m3u8.*?)["']/;
      const match = unpacked.match(fileRegex);

      if (match && match[1]) {
        return [{
          name: 'FileMoon Direct',
          url: match[1],
          quality: 'Auto',
          referer: url
        }];
      }
    } catch (e) {
      console.error('FileMoon extraction error:', e.message);
    }
    return null;
  }
};
