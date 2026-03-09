const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://www.overflix.me';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const cats = [
      { name: 'Filmes - Ação', path: '/filmes/acao' },
      { name: 'Séries - Ação', path: '/series/action-and-adventure' }
    ];

    const homeData = [];
    for (const cat of cats) {
      try {
        const res = await axios.get(`${mainUrl}${cat.path}`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('article[class*="group/item"]').each((i, el) => {
          const title = $(el).find('h2').text().trim() || $(el).find('img').attr('alt')?.replace(' poster', '');
          const href = $(el).find('a').attr('href');
          const poster = $(el).find('img').attr('src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: href.includes('/filme/') ? 'Movie' : 'TvSeries',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: cat.name, list: items });
      } catch (e) {
        console.error(`Error in OverFlix cat ${cat.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/pesquisa?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('article.relative.group\\/item').each((i, el) => {
      const title = $(el).find('h2').text().trim() || $(el).find('img').attr('alt');
      const href = $(el).find('a').attr('href');
      const poster = $(el).find('img').attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: href.includes('/filme/') ? 'Movie' : 'TvSeries',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const isMovie = url.includes('/filme/');
    const title = $('h1.text-3xl, h2.text-3xl').first().text().trim();
    const plot = $('div.text-subs.md\\:text-lg').first().text().trim() || $('div.text-subs').first().text().trim();
    const poster = $('img[src*=original]').attr('src') || $('article img').attr('src');
    const year = $('span').toArray().find(el => $(el).text().match(/\d{4}/))?.children[0]?.data;

    const episodes = [];
    if (!isMovie) {
      $('div[id^="season-"]').each((i, sEl) => {
        const seasonNum = (i + 1);
        $(sEl).find('article').each((j, epEl) => {
          const epHref = $(epEl).find('a').attr('href');
          const epTitle = $(epEl).find('h2').text().trim();
          const epNumMatch = $(epEl).find('span.text-main').text().match(/E(\d+)/);

          if (epHref) {
            episodes.push({
              name: epTitle,
              url: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`,
              episode: parseInt(epNumMatch?.[1]) || (j + 1),
              season: seasonNum,
              data: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`
            });
          }
        });
      });
    }

    return {
      name: title,
      url,
      type: isMovie ? 'Movie' : 'TvSeries',
      posterUrl: poster,
      plot,
      year: parseInt(year) || null,
      episodes: isMovie ? undefined : episodes,
      dataUrl: isMovie ? url : undefined
    };
  },

  async loadLinks(data) {
    return [{ name: 'OverFlix Player', url: data }];
  }
};
