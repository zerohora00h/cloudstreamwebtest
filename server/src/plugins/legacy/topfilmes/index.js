const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://www.topfilmes.biz';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Ação', path: '/genero/acao' },
      { name: 'Animação', path: '/genero/animacao' },
      { name: 'Comédia', path: '/genero/comedia' }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(`${mainUrl}${section.path}`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div.filmes div.filme').each((i, el) => {
          const title = $(el).find('div.title').text().trim() || $(el).find('h2').text().trim() || $(el).find('img').attr('alt');
          const href = $(el).find('a').attr('href');
          const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error in TopFilmes section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/busca?q=${encodeURIComponent(query).replace(/%20/g, '+')}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.filmes div.filme, div.filme, div.card').each((i, el) => {
      const title = $(el).find('div.title').text().trim() || $(el).find('img').attr('alt');
      const href = $(el).find('a').attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('div.infos h2').text().trim() || 'Sem título';
    const postImg = $('div.player img').attr('src');
    const poster = postImg ? (postImg.startsWith('http') ? postImg : `${mainUrl}${postImg}`) : null;
    const plot = $('div.infos div.sinopse').text().trim();
    const year = $('div.infos div.info').first().text().trim();

    const players = [];
    $('div.links_dub a, a[href*="player"]').each((i, el) => {
      const pUrl = $(el).attr('href');
      if (pUrl) players.push(pUrl.startsWith('//') ? 'https:' + pUrl : (pUrl.startsWith('http') ? pUrl : `${mainUrl}${pUrl}`));
    });

    return {
      name: title,
      url,
      type: 'Movie',
      posterUrl: poster,
      plot,
      year: parseInt(year) || null,
      dataUrl: JSON.stringify(players)
    };
  },

  async loadLinks(data) {
    try {
      const urls = JSON.parse(data);
      return urls.map(u => ({ name: 'TopFilmes Mirror', url: u }));
    } catch (e) { }
    return [{ name: 'TopFilmes Player', url: data }];
  }
};
