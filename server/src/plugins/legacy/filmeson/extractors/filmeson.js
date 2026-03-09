const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: 'FilmesOn',
  domains: ['filmeson1.site', 'tudoverhd.online', 'azullog.site', '1take.lat', 'mediafire.com'],

  async extract(url) {
    try {
      const mainUrl = 'https://filmeson1.site';
      const res = await axios.get(url, { headers: { 'Referer': mainUrl } });
      const $ = cheerio.load(res.data);
      const playerOptions = $('ul#playeroptionsul li.dooplay_player_option');

      const links = [];

      for (const option of playerOptions.toArray()) {
        const server = $(option).find('span.server').text().trim();
        // Apenas servidores suportados pelo original
        if (server.includes('tudoverhd.online') || server.includes('azullog.site') || server.includes('FHD')) {
          try {
            const embedUrl = await this.requestEmbedUrl($, $(option), url, mainUrl);
            if (embedUrl) {
              const embeddedLinks = await this.processEmbedPage(embedUrl);
              if (embeddedLinks) links.push(...embeddedLinks);
            }
          } catch (e) { }
        }
      }
      return links.length > 0 ? links : null;
    } catch (e) {
      console.error('[FilmesOn Extractor] Error:', e.message);
      return null;
    }
  },

  async requestEmbedUrl($, option, referer, mainUrl) {
    const payload = new URLSearchParams({
      action: 'doo_player_ajax',
      post: option.attr('data-post'),
      nume: option.attr('data-nume'),
      type: option.attr('data-type')
    });

    try {
      const res = await axios.post(`${mainUrl}/wp-admin/admin-ajax.php`, payload, {
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'referer': referer,
          'origin': mainUrl
        }
      });

      const embedUrlMatch = JSON.stringify(res.data).match(/"embed_url"\s*:\s*"([^"]+)"/);
      if (embedUrlMatch) return embedUrlMatch[1].replace(/\\\//g, '/').replace(/\\/g, '');

      const iframe$ = cheerio.load(res.data);
      return iframe$('iframe').attr('src');
    } catch (e) {
      return null;
    }
  },

  async processEmbedPage(url) {
    try {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);
      const links = [];

      for (const option of $('div.player_select_item').toArray()) {
        let embedData = $(option).attr('data-embed');
        if (embedData.includes('filecdn')) {
          embedData = embedData.replace(/filecdn\d*\.site/, '1take.lat');
        }
        const prefix = $(option).find('.player_select_name').text().trim();

        if (embedData) {
          try {
            const step2Res = await axios.get(embedData, { headers: { 'Referer': url } });
            const step2$ = cheerio.load(step2Res.data);
            let finalIframe = step2$('iframe[src*="player_2.php"]').attr('src');

            if (finalIframe) {
              if (finalIframe.startsWith('//')) finalIframe = 'https:' + finalIframe;
              const finalLink = await this.handleFinalStep(finalIframe, embedData, prefix);
              if (finalLink) links.push(finalLink);
            }
          } catch (e) { }
        }
      }
      return links;
    } catch (e) { return null; }
  },

  async handleFinalStep(playerUrl, referer, prefix) {
    try {
      const res = await axios.get(playerUrl, { headers: { 'Referer': referer } });
      const apiUrlMatch = res.data.match(/const apiUrl = `([^`]+)`/);
      if (!apiUrlMatch) return null;

      const mediafireMatch = apiUrlMatch[1].match(/[?&]url=([^&]+)/);
      if (!mediafireMatch) return null;

      const mediafireUrl = decodeURIComponent(mediafireMatch[1]);
      const mfRes = await axios.get(mediafireUrl);
      const mf$ = cheerio.load(mfRes.data);
      const direct = mf$('a#downloadButton').attr('href');

      if (direct) {
        return {
          name: `${prefix} - FilmesOn`,
          url: direct,
          quality: '1080p',
          headers: {
            'Referer': mediafireUrl,
            'User-Agent': 'Mozilla/5.0'
          }
        };
      }
    } catch (e) { return null; }
  }
};
