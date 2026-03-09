const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://ultracine.org';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Lançamentos', path: '/category/lancamentos/' },
      { name: 'Ação', path: '/category/acao/' },
      { name: 'Séries', path: '/category/series/' }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(`${mainUrl}${section.path}`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.aa-cn div#movies-a ul.post-lst li').each((i, el) => {
          const title = $(el).find('header.entry-header h2.entry-title').text().trim();
          const href = $(el).find('a.lnk-blk').attr('href');
          const poster = $(el).find('div.post-thumbnail figure img').attr('src') || $(el).find('div.post-thumbnail figure img').attr('data-src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error in UltraCine section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.aa-cn div#movies-a ul.post-lst li').each((i, el) => {
      const title = $(el).find('header.entry-header h2.entry-title').text().trim();
      const href = $(el).find('a.lnk-blk').attr('href');
      const poster = $(el).find('div.post-thumbnail figure img').attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('aside.fg1 header.entry-header h1.entry-title').text().trim();
    const poster = $('div.bghd img.TPostBg').attr('src')?.replace('/w1280/', '/original/') || $('div.bghd img.TPostBg').attr('data-src');
    const plot = $('aside.fg1 div.description p').text().trim();
    const isSerie = url.includes('/serie/');
    const iframeUrl = $('iframe[src*="assistirseriesonline.icu"]').attr('src');

    const episodes = [];
    if (isSerie && iframeUrl) {
      try {
        const epRes = await axios.get(iframeUrl);
        const ep$ = cheerio.load(epRes.data);
        const seasons = ep$('ul.header-navigation li[data-season-id]');

        seasons.each((i, sEl) => {
          const seasonNum = $(sEl).attr('data-season-number') || 1;
          const seasonId = $(sEl).attr('data-season-id');

          ep$(`li[data-season-id="${seasonId}"]`).each((j, epEl) => {
            const epId = $(epEl).attr('data-episode-id');
            const epName = $(epEl).find('a').text().trim();
            const epNumMatch = epName.match(/(\d+)/);

            if (epId) {
              episodes.push({
                name: epName,
                url: epId, // Usamos o ID como data
                episode: parseInt(epNumMatch?.[1]) || (j + 1),
                season: parseInt(seasonNum),
                data: epId
              });
            }
          });
        });
      } catch (e) { }
    }

    return {
      name: title,
      url,
      type: isSerie ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot,
      episodes: isSerie ? episodes : undefined,
      dataUrl: isSerie ? undefined : (iframeUrl || url)
    };
  },

  async loadLinks(data) {
    return [{ name: 'UltraCine Player', url: data }];
  }
};
