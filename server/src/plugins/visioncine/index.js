const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://cnvsweb.stream';

// Fixed internal ID from Kotlin source
const INTERNAL_DRM_ID = "pygrp_KJp_cyHo0.lbp-kBz.mo52lYEgGDK1tDG9tb_9GXI_";

function getAppConfigToken() {
  const os = 5;
  const stdArr = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 38, 42];
  const std = stdArr.map(c => String.fromCharCode(c + os)).join("");

  const op = 3;
  const tpArr = [119, 62, 117, 63, 118, 64, 116, 65, 115, 66, 114, 67, 113, 68, 112, 69, 111, 70, 110, 71, 109, 72, 108, 73, 107, 75, 106, 74, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 40, 42, 92, 87, 85, 86, 84, 43, 39, 30, 33, 32, 34, 35];
  const tp = tpArr.map(c => String.fromCharCode(c + op)).join("");

  let sb = "";
  for (let c of INTERNAL_DRM_ID) {
    let i = tp.indexOf(c);
    if (i !== -1 && i < std.length) {
      sb += std[i];
    } else {
      if (c === '!') sb += '+';
      else if (c === '$') sb += '/';
      else sb += c;
    }
  }

  let buffer = sb;
  while (buffer.length % 4 !== 0) buffer += "=";
  return Buffer.from(buffer, 'base64').toString('utf8').trim();
}

function getHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': getAppConfigToken()
  };
}

const homeGenres = [
  { name: 'Populares', id: '207' },
  { name: 'Ação', id: '85' },
  { name: 'Animes', id: '94' },
  { name: 'Séries Netflix', id: '73' }
];

module.exports = {
  /**
   * Fetches content for the home screen by iterating through predefined genres.
   */
  async getHome() {
    const homeData = [];
    for (const genre of homeGenres) {
      try {
        const url = `${mainUrl}/ajax/genre.php?genre=${genre.id}&page=1`;
        const res = await axios.get(url, { headers: getHeaders() });

        const list = (res.data || []).map(item => {
          const isSeries = item.time?.toLowerCase().includes('temporadas');
          return {
            name: item.title?.replace(/[\n\r]+/g, ' ').trim() || '',
            url: `${mainUrl}/watch/${item.slug}`,
            type: isSeries ? 'TvSeries' : 'Movie',
            posterUrl: item.image ? item.image.replace('/w300/', '/original/') : '',
            year: parseInt(item.release) || null,
            score: parseFloat(item.imdb_rating) || null
          };
        });
        if (list.length > 0) {
          homeData.push({ name: genre.name, list });
        }
      } catch (err) {
        console.error(`Erro ao buscar gênero ${genre.name}:`, err.message);
      }
    }
    return homeData;
  },

  /**
   * Performs a search on the website and parses the results.
   */
  async search(query) {
    const url = `${mainUrl}/search.php?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: getHeaders() });
    const $ = cheerio.load(res.data);
    const results = [];

    $('section.listContent .item.poster').each((i, el) => {
      const a = $(el).find('a.btn.free, a.btn.free.fw-bold').first();
      const href = a.attr('href');
      if (!href) return;

      const title = $(el).find('h6').first().text().replace(/[\n\r]+/g, ' ').trim();
      if (!title) return;

      const style = $(el).find('.content').first().attr('style') || '';
      const match = style.match(/url\((.*?)\)/);
      let img = match ? match[1] : '';
      img = img.replace('/w300/', '/original/');

      const scoreText = $(el).find('span').filter((i, e) => $(e).text().includes('IMDb')).text();
      const score = parseFloat(scoreText.replace('IMDb', '').trim()) || null;

      const tags = $(el).find('.tags').first().text() || '';
      const yearMatch = tags.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;
      const type = (tags.toLowerCase().includes('temporada')) ? 'TvSeries' : 'Movie';

      results.push({
        name: title,
        url: href,
        type,
        posterUrl: img,
        year,
        score
      });
    });

    return results;
  },

  /**
   * Loads the details of a specific movie or series, including episodes if applicable.
   */
  async load(url) {
    const res = await axios.get(url, { headers: getHeaders() });
    const $ = cheerio.load(res.data);

    const name = $('h1.fw-bolder').first().text().replace(/[\n\r]+/g, ' ').trim();
    const plot = $('p.small.linefive').first().text().trim();
    const yearText = $('p.log span').text();
    const year = parseInt(yearText) || null;

    const posterStyle = $('.backImage').first().attr('style') || '';
    const posterMatch = posterStyle.match(/url\('(.+?)'\)/);
    const posterUrl = posterMatch ? posterMatch[1].replace('/w300/', '/original/') : '';

    const tags = [];
    $('.producerInfo p.lineone').each((i, el) => {
      if ($(el).find('span').first().text().toLowerCase().includes('gênero')) {
        $(el).find('span span').each((j, span) => {
          tags.push($(span).text().trim());
        });
      }
    });

    const scoreText = $('span').filter((i, e) => $(e).text().includes('IMDb')).text();
    const score = parseFloat(scoreText.replace('IMDb', '').trim()) || null;

    const durationText = $('span').filter((i, e) => $(e).text().toLowerCase().includes('min')).text();
    const duration = parseInt(durationText.toLowerCase().replace('min', '').trim()) || null;

    const isSerie = url.includes('/series') || $('#seasons-view').length > 0;

    if (isSerie) {
      const episodes = [];
      const seasons = $('#seasons-view option').map((i, el) => $(el).attr('value')).get();

      for (let i = 0; i < seasons.length; i++) {
        const seasonId = seasons[i];
        const seasonNumber = i + 1;

        try {
          const epUrl = `${mainUrl}/ajax/episodes.php?season=${seasonId}&page=1`;
          const epRes = await axios.get(epUrl, { headers: { ...getHeaders(), Referer: url } });
          const $ep = cheerio.load(epRes.data);

          $ep('div.ep').each((j, el) => {
            const epNumText = $ep(el).find('p[number]').attr('number') || $ep(el).find('p[number]').text();
            const epNum = parseInt(epNumText) || Number(epNumText) || 0;
            const epName = $ep(el).find('h5.fw-bold').text().replace(/[\n\r]+/g, ' ').trim() || `Episódio ${epNum}`;
            const playBtn = $ep(el).find('a.btn.free.fw-bold, a.btn.free').first();
            const episodeUrl = playBtn.attr('href');

            if (episodeUrl) {
              episodes.push({
                name: epName,
                episode: epNum,
                season: seasonNumber,
                data: episodeUrl
              });
            }
          });
        } catch (e) { console.error('Erro ao buscar temporada:', e.message) }
      }

      return {
        name, url, type: 'TvSeries', posterUrl, plot, year, tags, score, duration, episodes
      }
    } else {
      const watchBtn = $('div.buttons a.btn.free[href*="/m/"]').first();
      let watchUrl = watchBtn.attr('href');
      let dataUrl = url;
      if (watchUrl) {
        dataUrl = watchUrl.startsWith('http') ? watchUrl : `http://www.playcnvs.stream${watchUrl}`;
      }

      return {
        name, url, type: 'Movie', posterUrl, plot, year, tags, score, duration, dataUrl
      }
    }
  },

  /**
   * Extracts the actual streaming links (video URLs) from the provided data.
   */
  async loadLinks(data) {
    let episodeUrl = data.startsWith('[') ? data.replace(/^\["?|"?\]$/g, '').split('|').pop() : data;

    try {
      const res = await axios.get(episodeUrl, { headers: getHeaders() });
      const html = res.data;
      const $ = cheerio.load(html);

      const sources = [];

      $('.sources-dropdown .dropdown-menu a.source-btn').each((i, el) => {
        const href = $(el).attr('href');
        let tagTxt = $(el).clone().children().remove().end().text().trim();
        if (!tagTxt) tagTxt = $(el).text().replace($(el).find('label').text(), '').trim();

        const badge = $(el).find('label.badge').text().trim();
        const name = badge ? `${tagTxt} (${badge})` : tagTxt;

        if (href && !href.startsWith('#')) {
          const abs = href.startsWith('http') ? href : `http://www.playcnvs.stream${href}`;
          sources.push({ name, url: abs });
        }
      });

      if (sources.length === 0) {
        $('a.btn.free').each((i, el) => {
          const href = $(el).attr('href');
          if (href && (href.includes('/s/') || href.includes('/m/')) && !href.includes('history.go')) {
            const abs = href.startsWith('http') ? href : `http://www.playcnvs.stream${href}`;
            sources.push({ name: $(el).text().trim(), url: abs });
          }
        });
      }

      return sources;
    } catch (e) {
      console.error('Error fetching links', e.message);
      return [];
    }
  }
};
