const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'TopFilmes',
  domains: ['topfilmes.biz'],

  async extract(url) {
    try {
      const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
      // Ajusta URL do player conforme lógica Kotlin replace(Regex("player=\\d+"), "player=1")
      const finalPlayerUrl = url.includes('player=') ? url.replace(/player=\d+/, 'player=1') : url;

      const res = await axios.get(finalPlayerUrl, { headers: { 'User-Agent': USER_AGENT } });
      const $ = cheerio.load(res.data);

      const links = [];
      const videoSrc = $('video#player, video, source[type="video/mp4"]').attr('src');

      if (videoSrc) {
        links.push({
          name: 'TopFilmes Direct',
          url: videoSrc.startsWith('//') ? 'https:' + videoSrc : videoSrc,
          quality: 'Auto'
        });
      }

      return links.length > 0 ? links : null;
    } catch (e) {
      return null;
    }
  }
};
