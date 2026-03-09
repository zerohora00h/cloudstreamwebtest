const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'NetCine',
  domains: ['nnn1.lat'],

  async extract(url) {
    try {
      const mainUrl = 'https://nnn1.lat';
      const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

      const sessionHeaders = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'cookie': 'XCRF=XCRF; PHPSESSID=v8fk5egon2jcqo69hs7d9cail1',
        'user-agent': USER_AGENT,
        'referer': `${mainUrl}/`
      };

      const res = await axios.get(url, { headers: sessionHeaders });
      const html = res.data;

      const iframeRegex = /<div\s+id="(play-\d+)"[^>]*>.*?<iframe\s+src="([^"]+)"/gs;
      const labelRegex = /<a\s+href="#(play-\d+)">([^<]+)<\/a>/g;

      const matches = [...html.matchAll(iframeRegex)];
      const labels = [...html.matchAll(labelRegex)].reduce((acc, m) => {
        acc[m[1]] = m[2].trim();
        return acc;
      }, {});

      const links = [];
      for (const match of matches) {
        const playId = match[1];
        const iframeSrc = match[2];
        const label = labels[playId] || 'Player';

        try {
          const res2 = await axios.get(iframeSrc, { headers: { ...sessionHeaders, 'referer': url } });
          const videoMatch = res2.data.match(/<source\s+[^>]*src=["']([^"']+)["']/);
          if (videoMatch) {
            links.push({
              name: `NetCine ${label}`,
              url: videoMatch[1],
              type: videoMatch[1].includes('.m3u8') ? 'm3u8' : 'video'
            });
          }
        } catch (e) { }
      }

      return links.length > 0 ? links : null;
    } catch (e) {
      return null;
    }
  }
};
