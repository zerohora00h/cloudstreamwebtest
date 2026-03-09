const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://animesdigital.org';

async function getSecurityToken(url) {
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    return $('.menu_filter_box').attr('data-secury') || 'c1deb78cd4';
  } catch (e) {
    return 'c1deb78cd4';
  }
}

function apiHeaders(ref) {
  return {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'x-requested-with': 'XMLHttpRequest',
    'referer': ref
  };
}

module.exports = {
  async getHome() {
    const sections = [
      { id: 'últimos', name: 'Animes - Últimos Episódios', url: `${mainUrl}/home` },
      { id: 'legendados', name: 'Animes - Legendados', url: `${mainUrl}/animes-legendados-online` },
      { id: 'dublados', name: 'Animes - Dublados', url: `${mainUrl}/animes-dublado` },
      { id: 'filmes', name: 'Animes - Filmes', url: `${mainUrl}/filmes` },
      { id: 'desenhos', name: 'Desenhos Animados', url: `${mainUrl}/desenhos-online` }
    ];

    const homeData = [];
    for (const section of sections) {
      try {
        if (section.id === 'últimos') {
          const res = await axios.get(section.url);
          const $ = cheerio.load(res.data);
          const items = [];
          $('.itemE, .itemA').each((i, el) => {
            const titleEl = $(el).find('a').first();
            const href = titleEl.attr('href');
            const animeTitle = $(el).find('.title_anime').text().trim();
            const epText = $(el).find('.number').text().trim();
            const poster = $(el).find('img').attr('src');

            if (href && animeTitle) {
              items.push({
                name: `${animeTitle} - ${epText}`,
                url: href,
                type: 'TvSeries',
                posterUrl: poster
              });
            }
          });
          homeData.push({ name: section.name, list: items });
        } else {
          // Logic for API sections
          const token = await getSecurityToken(section.url);
          const typeUrl = section.id === 'filmes' ? 'filmes' : (section.id === 'desenhos' ? 'desenhos' : 'animes');
          const filterAudio = section.id === 'dublados' ? 'dublado' : (section.id === 'legendados' ? 'legendado' : '0');

          const postData = new URLSearchParams({
            token,
            pagina: '1',
            search: '0',
            limit: '30',
            type: 'lista',
            filters: JSON.stringify({
              filter_data: `filter_letter=0&type_url=${typeUrl}&filter_audio=${filterAudio}&filter_order=name`,
              filter_genre_add: [],
              filter_genre_del: []
            })
          });

          const res = await axios.post(`${mainUrl}/func/listanime`, postData, { headers: apiHeaders(section.url) });
          const items = [];
          if (res.data && res.data.results) {
            res.data.results.forEach(html => {
              const $ = cheerio.load(html);
              const item = $('.itemA').first();
              const titleEl = item.find('a').first();
              const href = titleEl.attr('href');
              const title = titleEl.text().trim() || item.find('img').attr('title');
              const poster = item.find('img').attr('src');

              if (href && title) {
                items.push({
                  name: title,
                  url: href,
                  type: section.id === 'filmes' ? 'Movie' : 'TvSeries',
                  posterUrl: poster
                });
              }
            });
          }
          homeData.push({ name: section.name, list: items });
        }
      } catch (e) {
        console.error(`Error in AnimesDigital section ${section.name}:`, e.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const results = [];

    $('div.itemE, div.itemA').each((i, el) => {
      const titleEl = $(el).find('a').first();
      const href = titleEl.attr('href');
      const title = titleEl.text().trim() || $(el).find('img').attr('title');
      const poster = $(el).find('img').attr('src');

      if (href && title) {
        results.push({
          name: title,
          url: href,
          type: (href.includes('/filme/') || title.toLowerCase().includes('filme')) ? 'Movie' : 'TvSeries',
          posterUrl: poster
        });
      }
    });

    return results;
  },

  async load(url) {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    if (url.includes('/video/a/')) {
      // Episode load
      const title = $('meta[property="og:title"]').attr('content');
      const poster = $('meta[property="og:image"]').attr('content');
      const animeTitle = $('.info span:contains(Anime) + span').text().trim() || title;

      return {
        name: animeTitle,
        url,
        type: 'TvSeries',
        posterUrl: poster,
        episodes: [{
          name: title,
          url,
          episode: 1, // Simplified
          data: url
        }]
      };
    } else {
      // Anime load
      const title = $('h1').first().text().trim();
      const poster = $('.foto img').attr('src');
      const description = $('.sinopse').text().trim();
      const isMovie = url.includes('/filme/');

      const episodes = [];
      $('.item_ep a').each((i, el) => {
        const href = $(el).attr('href');
        const epTitle = $(el).find('.title_ep').text().trim() || $(el).find('img').attr('title');
        if (href) {
          episodes.push({
            name: epTitle,
            url: href,
            data: href
          });
        }
      });

      return {
        name: title,
        url,
        type: isMovie ? 'Movie' : 'TvSeries',
        posterUrl: poster,
        plot: description,
        episodes
      };
    }
  },

  async loadLinks(data) {
    return [{ name: 'AnimesDigital Player', url: data }];
  }
};
