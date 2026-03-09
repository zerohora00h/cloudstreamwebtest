const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

module.exports = {
  name: 'AnimesCloud',
  domains: ['animesonline.cloud', 'animeshd.cloud', 'animes.strp2p.com'],

  async extract(url) {
    try {
      const mainUrl = 'https://animesonline.cloud';
      const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
      const $ = cheerio.load(res.data);
      const playerOptions = $('ul#playeroptionsul li.dooplay_player_option');

      const links = [];

      for (const option of playerOptions.toArray()) {
        const dataType = $(option).attr('data-type');
        const dataPost = $(option).attr('data-post');
        const dataNume = $(option).attr('data-nume');
        const title = $(option).find('span.title').text().trim();

        if (title.toLowerCase().includes('mobile') || title.toLowerCase().includes('celular')) continue;

        if (dataType && dataPost && dataNume) {
          const ajaxUrl = `${mainUrl}/wp-json/dooplayer/v2/${dataPost}/${dataType}/${dataNume}`;
          try {
            const ajaxRes = await axios.get(ajaxUrl, {
              headers: { 'User-Agent': USER_AGENT, 'Referer': url },
              timeout: 10000
            });
            const embedUrl = ajaxRes.data.embed_url?.replace(/\\\//g, '/').replace(/\\/g, '');

            if (embedUrl) {
              if (embedUrl.includes('source=') && (embedUrl.includes('.mp4') || embedUrl.includes('.m3u8'))) {
                const match = embedUrl.match(/source=([^&]+)/);
                if (match) {
                  const directUrl = decodeURIComponent(match[1]);
                  links.push({
                    name: `AnimesCloud ${title}`,
                    url: directUrl,
                    quality: title.includes('FullHD') ? '1080p' : 'Auto',
                    referer: mainUrl
                  });
                }
              } else if (embedUrl.includes('animeshd.cloud') || embedUrl.includes('animes.strp2p.com')) {
                // These are VidStack mirrors, we could try to extract directly if we had a VidStack global extractor
                // For now, return the embed as is, and let global extractors handle it if they exist
                links.push({
                  name: `AnimesCloud ${title}`,
                  url: embedUrl,
                  quality: 'Unknown'
                });
              }
            }
          } catch (e) { }
        }
      }
      return links.length > 0 ? links : null;
    } catch (e) {
      console.error('[AnimesCloud Extractor] Error:', e.message);
      return null;
    }
  }
};
