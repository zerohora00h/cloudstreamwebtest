const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://goflixy.lol';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const cats = [
      { name: 'Lançamentos', path: 'lancamentos' },
      { name: 'Ação', path: 'categoria/acao' },
      { name: 'Animação', path: 'categoria/animacao' }
    ];

    const homeData = [];
    for (const cat of cats) {
      try {
        const res = await axios.get(`${mainUrl}/${cat.path}/`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.grid a.card').each((i, el) => {
          const title = $(el).find('div.card-title').text().trim();
          const href = $(el).attr('href');
          const poster = $(el).find('img.card-img').attr('src')?.replace('w342', 'original');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: $(el).find('span.badge-kind').text().includes('SÉRIE') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: cat.name, list: items });
      } catch (e) {
        console.error(`Error in GoFlix cat ${cat.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/buscar?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.grid a.card').each((i, el) => {
      const title = $(el).find('div.card-title').text().trim();
      const href = $(el).attr('href');
      const poster = $(el).find('img.card-img').attr('src')?.replace('w342', 'original');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: $(el).find('span.badge-kind').text().includes('SÉRIE') ? 'TvSeries' : 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('div.title').first().text().trim();
    const poster = $('img.poster').attr('src')?.replace('w500', 'original');
    const plot = $('div.syn').text().trim();
    const isSeries = $('div.tabs button.tab').length > 0;

    const episodes = [];
    if (isSeries) {
      $('div.tabs button.tab').each((i, tab) => {
        const seasonNum = $(tab).text().match(/T(\d+)/)?.[1] || (i + 1);
        const target = $(tab).attr('data-target');
        const section = $(`div.section#${target}`);

        section.find('table.ep-table tbody tr').each((j, row) => {
          const epLabel = $(row).find('td.ep-col').text().trim();
          const epNum = epLabel.match(/Episódio (\d+)/)?.[1] || (j + 1);
          const playBtn = $(row).find('button.btn.bd-play');
          const epUrl = playBtn.attr('data-url');

          if (epUrl) {
            episodes.push({
              name: `Episódio ${epNum}`,
              url: epUrl,
              episode: parseInt(epNum),
              season: parseInt(seasonNum),
              data: epUrl
            });
          }
        });
      });
    }

    return {
      name: title,
      url,
      type: isSeries ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot,
      episodes: isSeries ? episodes : undefined,
      dataUrl: isSeries ? undefined : url
    };
  },

  async loadLinks(data) {
    return [{ name: 'GoFlix Player', url: data }];
  }
};
