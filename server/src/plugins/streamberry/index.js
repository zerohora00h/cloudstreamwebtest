const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://streamberry.com.br';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Filmes', path: '/filmes/' },
      { name: 'Séries', path: '/series/' }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(`${mainUrl}${section.path}`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div#archive-content article.item').each((i, el) => {
          const title = $(el).find('h3 a').text().trim() || $(el).find('img').attr('alt')?.trim();
          const href = $(el).find('a').attr('href');
          const poster = $(el).find('.poster img').attr('src') || $(el).find('.poster noscript img').attr('src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: $(el).hasClass('movies') ? 'Movie' : 'TvSeries',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error in Streamberry section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}?s=${encodeURIComponent(query).replace(/%20/g, '+')}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.result-item article').each((i, el) => {
      const title = $(el).find('.details .title a').text().trim() || $(el).find('img').attr('alt')?.trim();
      const href = $(el).find('.image a').attr('href');
      const poster = $(el).find('.thumbnail img').attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: $(el).find('.image span.movies').length > 0 ? 'Movie' : 'TvSeries',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('.sheader .data h1').text().trim() || 'Sem título';
    const plot = $('#info .wp-content p').text().trim();
    const poster = $('.sheader .poster img').attr('src') || $('.sheader .poster noscript img').attr('src');
    const isSerie = url.includes('/series/');

    const episodes = [];
    if (isSerie) {
      $('#seasons .se-c ul.episodios li').each((i, el) => {
        const numerando = $(el).find('.numerando').text().split('-').map(s => s.trim());
        const seasonNum = numerando[0] || 1;
        const epNum = numerando[1] || (i + 1);
        const epTitle = $(el).find('.episodiotitle a').text().trim() || `Episódio ${epNum}`;
        const epUrl = $(el).find('.episodiotitle a').attr('href');

        if (epUrl) {
          episodes.push({
            name: epTitle,
            url: epUrl.startsWith('http') ? epUrl : `${mainUrl}${epUrl}`,
            episode: parseInt(epNum),
            season: parseInt(seasonNum),
            data: epUrl.startsWith('http') ? epUrl : `${mainUrl}${epUrl}`
          });
        }
      });
    } else {
      // Para filmes, pegamos o link de dublado ou legendado
      const dubladoLink = $('.fix-table tbody tr').filter((i, row) => $(row).find('td:nth-child(3)').text().includes('Dublado')).find('a').attr('href');
      return {
        name: title,
        url,
        type: 'Movie',
        posterUrl: poster,
        plot,
        dataUrl: dubladoLink || url
      };
    }

    return {
      name: title,
      url,
      type: 'TvSeries',
      posterUrl: poster,
      plot,
      episodes
    };
  },

  async loadLinks(data) {
    return [{ name: 'Streamberry Player', url: data }];
  }
};
