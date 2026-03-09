const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://novelasflix4k.me';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

module.exports = {
  async getHome() {
    const cats = [
      { name: 'Top IMDB', path: 'top100.html' },
      { name: 'Ação', path: 'genero/acao/' },
      { name: 'Drama', path: 'genero/drama/' }
    ];

    const homeData = [];
    for (const cat of cats) {
      try {
        const res = await axios.get(`${mainUrl}/${cat.path}`, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(res.data);
        const items = [];

        $('div#dle-content div.default.poster.grid-item.has-overlay').each((i, el) => {
          const title = $(el).find('h3.poster__title a span').text().trim();
          const href = $(el).find('h3.poster__title a').attr('href');
          const poster = $(el).find('div.poster__img img').attr('src');

          if (title && href) {
            items.push({
              name: title,
              url: href.startsWith('http') ? href : `${mainUrl}${href}`,
              type: title.includes('Temporada') || title.includes('Série') ? 'TvSeries' : 'Movie',
              posterUrl: poster
            });
          }
        });

        if (items.length > 0) homeData.push({ name: cat.name, list: items });
      } catch (e) {
        console.error(`Error in NovelasFlix cat ${cat.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/index.php?do=search`;
    const payload = new URLSearchParams({
      do: 'search',
      subaction: 'search',
      search_start: '0',
      full_search: '0',
      result_from: '1',
      story: query
    });

    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          'Referer': `${mainUrl}/`
        }
      });
      const $ = cheerio.load(res.data);
      const results = [];

      $('div#dle-content div.default.poster.grid-item.has-overlay').each((i, el) => {
        const title = $(el).find('h3.poster__title a span').text().trim();
        const href = $(el).find('h3.poster__title a').attr('href');
        const poster = $(el).find('div.poster__img img').attr('src');

        if (title && href) {
          results.push({
            name: title,
            url: href.startsWith('http') ? href : `${mainUrl}${href}`,
            type: title.includes('Temporada') || title.includes('Série') ? 'TvSeries' : 'Movie',
            posterUrl: poster
          });
        }
      });

      return results;
    } catch (e) {
      return [];
    }
  },

  async load(url) {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(res.data);

    const title = $('h1').first().text().trim().replace(/Assistir|Online|Grátis|Gratis/gi, '').trim();
    const poster = $('div.movieposter img').attr('src');
    const plot = $('div.movie-description').text().trim();
    const isSeries = $('div.seasons-v2').length > 0;

    const episodes = [];
    if (isSeries) {
      const seasonLinks = $('div.seasons-v2 a.season-link');
      for (const sLink of seasonLinks.toArray()) {
        const sUrl = $(sLink).attr('href');
        const sTitle = $(sLink).find('p.pstitle').text().trim();
        const sNumMatch = sTitle.match(/S(\d+)/) || sTitle.match(/Temporada (\d+)/);
        const seasonNum = sNumMatch ? sNumMatch[1] : 1;

        if (sUrl) {
          try {
            const sRes = await axios.get(sUrl.startsWith('http') ? sUrl : `${mainUrl}${sUrl}`, {
              headers: { 'User-Agent': USER_AGENT }
            });
            const s$ = cheerio.load(sRes.data);
            s$('div.seasoncontent a.epi-link').each((j, epEl) => {
              const epUrl = $(epEl).attr('href');
              const epName = $(epEl).find('p.epinicename').text().trim() || $(epEl).find('p.epiname').text().trim();
              const epNumMatch = $(epEl).find('p.epiname').text().match(/Serie (\d+)/);

              if (epUrl) {
                episodes.push({
                  name: epName,
                  url: epUrl.startsWith('http') ? epUrl : `${mainUrl}${epUrl}`,
                  episode: parseInt(epNumMatch?.[1]) || (j + 1),
                  season: parseInt(seasonNum),
                  data: epUrl.startsWith('http') ? epUrl : `${mainUrl}${epUrl}`
                });
              }
            });
          } catch (e) { }
        }
      }
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
    return [{ name: 'NovelasFlix Player', url: data }];
  }
};
