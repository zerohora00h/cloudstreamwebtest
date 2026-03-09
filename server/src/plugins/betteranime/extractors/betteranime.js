const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'BetterAnime',
  domains: ['betteranime.io', 'myblogapi.site'],

  async extract(url) {
    try {
      const mainUrl = 'https://betteranime.io';
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);

      const playerOption = $('li.dooplay_player_option[data-post][data-type][data-nume]').first();
      if (!playerOption.length) return null;

      const dataPost = playerOption.attr('data-post');
      const dataType = playerOption.attr('data-type');
      const dataNume = playerOption.attr('data-nume');

      const apiUrl = `https://betteranime.io/wp-json/dooplayer/v2/${dataPost}/${dataType}/${dataNume}`;
      const apiRes = await axios.get(apiUrl);
      const embedUrl = apiRes.data.embed_url?.replace(/\\\//g, '/');

      if (embedUrl) {
        const embedRes = await axios.get(embedUrl);
        const embed$ = cheerio.load(embedRes.data);

        let fileMatch = null;
        embed$('script').each((i, el) => {
          const content = $(el).html();
          const match = content.match(/"file":\s*"([A-Za-z0-9+/=]+)"/);
          if (match) fileMatch = match[1];
        });

        if (fileMatch) {
          const decodeUrl = `https://api.myblogapi.site/api/v1/decode/blogg/${fileMatch}`;
          const decodeRes = await axios.get(decodeUrl);

          if (decodeRes.data.status === 'success' && decodeRes.data.play) {
            return decodeRes.data.play.map(video => ({
              name: `BetterAnime ${video.sizeText}`,
              url: video.src,
              quality: video.sizeText,
              referer: 'https://betteranime.io'
            }));
          }
        }
      }
      return null;
    } catch (e) {
      console.error('[BetterAnime Extractor] Error:', e.message);
      return null;
    }
  }
};
