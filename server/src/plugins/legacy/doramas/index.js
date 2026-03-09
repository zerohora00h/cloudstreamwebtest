const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://doramasonline.co';

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Lançamentos', url: `${mainUrl}/category/lancamentos/` },
      { name: 'Comédia', url: `${mainUrl}/category/comedia/` },
      { name: 'Crime', url: `${mainUrl}/category/crime/` },
      { name: 'Drama', url: `${mainUrl}/category/drama/` }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(section.url);
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.aa-cn div#movies-a ul.post-lst li').each((i, el) => {
          const title = $(el).find('header.entry-header h2.entry-title').text().trim();
          const href = $(el).find('a.lnk-blk').attr('href');
          const poster = $(el).find('div.post-thumbnail figure img').attr('src');

          if (title && href) {
            items.push({
              name: title,
              url: href,
              type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) {
          homeData.push({ name: section.name, list: items });
        }
      } catch (e) {
        console.error(`Error in Doramas section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.aa-cn div#movies-a ul.post-lst li').each((i, el) => {
      const title = $(el).find('header.entry-header h2.entry-title').text().trim();
      const href = $(el).find('a.lnk-blk').attr('href');
      const poster = $(el).find('div.post-thumbnail figure img').attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href,
          type: href.includes('/serie/') ? 'TvSeries' : 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    const title = $('aside.fg1 header.entry-header h1.entry-title').text().trim();
    const poster = $('div.bghd img.TPostBg').attr('src');
    const plot = $('aside.fg1 div.description p').text().trim();
    const isSerie = url.includes('/serie/');

    const episodes = [];
    if (isSerie) {
      // Tentativa de pegar o iframe do seriesboa.live
      const iframeMatch = res.data.match(/iframe[^>]+src="([^"]*seriesboa\.live[^"]*)"/);
      if (iframeMatch) {
        try {
          const playerRes = await axios.get(iframeMatch[1]);
          const p$ = cheerio.load(playerRes.data);

          p$('ul.header-navigation li[data-season-id]').each((i, seasonEl) => {
            const seasonNum = $(seasonEl).attr('data-season-number');
            const seasonId = $(seasonEl).attr('data-season-id');

            p$(`li[data-season-id='${seasonId}']`).each((j, epEl) => {
              const epId = $(epEl).attr('data-episode-id');
              const epName = $(epEl).find('a').text().trim();
              if (epId) {
                episodes.push({
                  name: epName,
                  url: `https://seriesboa.live/episodio/${epId}`,
                  episode: parseInt(epName.match(/\d+/)?.[0]) || 1,
                  season: parseInt(seasonNum) || 1,
                  data: `https://seriesboa.live/episodio/${epId}`
                });
              }
            });
          });
        } catch (e) {
          console.error('Error loading episodes for Doramas:', e.message);
        }
      }
    }

    return {
      name: title,
      url,
      type: isSerie ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot,
      episodes: episodes.length > 0 ? episodes : (isSerie ? [] : undefined),
      dataUrl: !isSerie ? (res.data.match(/iframe[^>]+src="([^"]*seriesboa\.live[^"]*)"/)?.[1] || url) : undefined
    };
  },

  async loadLinks(data) {
    return [{ name: 'Doramas Player', url: data }];
  }
};
