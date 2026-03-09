const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://nnn1.lat';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const defaultHeaders = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'cookie': 'XCRF=XCRF; PHPSESSID=v8fk5egon2jcqo69hs7d9cail1',
  'user-agent': USER_AGENT
};

module.exports = {
  async getHome() {
    const sections = [
      { name: 'Últimos Filmes', path: 'category/ultimos-filmes' },
      { name: 'Séries', path: 'tvshows' },
      { name: 'Animação', path: 'category/animacao' }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        const res = await axios.get(`${mainUrl}/${section.path}`, { headers: defaultHeaders });
        const $ = cheerio.load(res.data);
        const items = [];

        $('#box_movies > div.movie').each((i, el) => {
          const title = $(el).find('h2').text().trim();
          const href = $(el).find('a').first().attr('href');
          const posterImg = $(el).find('img').first();
          const poster = posterImg.attr('data-src') || posterImg.attr('src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: href.includes('tvshows') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: section.name, list: items });
      } catch (e) {
        console.error(`Error in NetCine section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: defaultHeaders });
    const $ = cheerio.load(res.data);
    const results = [];

    $('#box_movies > div.movie').each((i, el) => {
      const title = $(el).find('h2').text().trim();
      const href = $(el).find('a').first().attr('href');
      const posterImg = $(el).find('img').first();
      const poster = posterImg.attr('data-src') || posterImg.attr('src');

      if (title && href) {
        results.push({
          name: title,
          url: href.startsWith('http') ? href : `${mainUrl}${href}`,
          type: href.includes('tvshows') ? 'TvSeries' : 'Movie',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url, { headers: defaultHeaders });
    const $ = cheerio.load(res.data);

    const isTv = url.includes('tvshows') || url.includes('/episode/');
    const title = $('div.dataplus h1, div.dataplus span.original').first().text().trim();
    const bgPoster = $('div.headingder > div.cover').attr('data-bg');
    const poster = bgPoster ? (bgPoster.startsWith('http') ? bgPoster : `${mainUrl}${bgPoster}`) : null;
    const plot = $('#dato-2 p').text().trim();
    const year = $('#dato-1 > div:nth-child(5)').text().trim().match(/\d+/)?.[0];

    const episodes = [];
    if (isTv) {
      $('div.post #cssmenu > ul li > ul > li').each((i, el) => {
        const epHref = $(el).find('a').attr('href');
        const dateText = $(el).find('a > span.datex').text().trim();
        const epName = $(el).find('a > span.datix').text().trim();

        if (epHref) {
          const sMatch = dateText.split('-')[0]?.match(/\d+/);
          const eMatch = dateText.split('-')[1]?.match(/\d+/);
          episodes.push({
            name: epName || `Episódio ${eMatch?.[0]}`,
            url: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`,
            episode: parseInt(eMatch?.[0]) || (i + 1),
            season: parseInt(sMatch?.[0]) || 1,
            data: epHref.startsWith('http') ? epHref : `${mainUrl}${epHref}`
          });
        }
      });
    }

    return {
      name: title,
      url,
      type: isTv ? 'TvSeries' : 'Movie',
      posterUrl: poster,
      plot,
      year: parseInt(year) || null,
      episodes: isTv ? episodes : undefined,
      dataUrl: isTv ? undefined : url
    };
  },

  async loadLinks(data) {
    return [{ name: 'NetCine Player', url: data }];
  }
};
