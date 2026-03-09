const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.pobreflixtv.club';
const CURRENT_YEAR = new Date().getFullYear();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const homeGenres = [
  { name: `Filmes - ${CURRENT_YEAR}`, url: `${BASE_URL}/genero/filmes-de-${CURRENT_YEAR}-online-66/` },
  { name: `Séries - ${CURRENT_YEAR}`, url: `${BASE_URL}/genero/series-de-${CURRENT_YEAR}-online-83/` },
  { name: 'Filmes - Ação', url: `${BASE_URL}/genero/filmes-de-acao-online-3/` },
  { name: 'Séries - Ação', url: `${BASE_URL}/genero/series-de-acao-online-22/` },
  { name: 'Filmes - Comédia', url: `${BASE_URL}/genero/filmes-de-comedia-online-4/` },
  { name: 'Séries - Netflix', url: `${BASE_URL}/genero/series-de-netflix-online-44/` } // Example additional
];

function normalizeUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function fixUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

module.exports = {
  async getHome() {
    const homeData = [];
    for (const genre of homeGenres) {
      try {
        const res = await axios.get(genre.url, { headers });
        const $ = cheerio.load(res.data);

        const list = [];
        $('div.vbItemImage').each((i, el) => {
          const title = $(el).find('div.caption').text().replace(/[\n\r]+/g, ' ').trim();
          let link = $(el).find('a').first().attr('href');
          if (!title || !link) return;
          link = fixUrl(link);

          const container = $(el).find('div.vb_image_container');
          let poster = container.attr('data-background-src') || '';
          if (!poster) {
            const style = container.attr('style') || '';
            const match = style.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) {
              poster = match[1].replace(/&quot;/g, '').replace(/"/g, '');
            }
          }

          if (poster) {
            poster = poster.replace('w185', 'original');
            poster = fixUrl(poster);
          }

          const isSeries = genre.name.toLowerCase().includes('série');

          list.push({
            name: title,
            url: link,
            type: isSeries ? 'TvSeries' : 'Movie',
            posterUrl: poster || ''
          });
        });

        if (list.length > 0) {
          homeData.push({ name: genre.name, list });
        }
      } catch (err) {
        console.error(`Erro ao buscar gênero ${genre.name} no PobreFlix:`, err.message);
      }
    }
    return homeData;
  },

  async search(query) {
    const url = `${BASE_URL}/pesquisar/?p=${encodeURIComponent(query.replace(/ /g, '+'))}`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const results = [];
      $('div.vbItemImage').each((i, el) => {
        const title = $(el).find('div.caption').text().replace(/[\n\r]+/g, ' ').trim();
        let link = $(el).find('a').first().attr('href');
        if (!title || !link) return;
        link = fixUrl(link);

        const container = $(el).find('div.vb_image_container');
        let poster = container.attr('data-background-src') || '';
        if (!poster) {
          const style = container.attr('style') || '';
          const match = style.match(/url\(['"]?(.*?)['"]?\)/);
          if (match) {
            poster = match[1].replace(/&quot;/g, '').replace(/"/g, '');
          }
        }

        if (poster) {
          poster = poster.replace('w185', 'original');
          poster = fixUrl(poster);
        }

        // PobreFlix search doesn't explicitly tell if it's a TV series easily from the card, 
        // you'd have to check url or details. We'll default to Movie and correct on Load if needed.
        const isSeries = link.includes('serie') || link.includes('temporada');

        results.push({
          name: title,
          url: link,
          type: isSeries ? 'TvSeries' : 'Movie',
          posterUrl: poster || ''
        });
      });
      return results;
    } catch (e) {
      console.error('Erro na busca PobreFlix', e);
      return [];
    }
  },

  async load(url) {
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const isSeries = $('span.escolha_span').length > 0;
      const title = $('h1.ipsType_pageTitle span.titulo').text().replace(/[\n\r]+/g, ' ').trim() || 'Sem título';

      // Cleanup plot
      const plotEl = $('div.sinopse').clone();
      plotEl.find('span#myBtn').remove();
      plotEl.find('b').remove();
      const plot = plotEl.text().replace(/\.\.\./g, '').trim();

      let duration = null;
      $('div.infos span').each((i, el) => {
        const text = $(el).text();
        if (text.includes('min')) {
          duration = parseInt(text.replace('min', '').trim());
        }
      });

      const scoreText = $('div.infos span.imdb').first().text().replace('/10', '').trim();
      const score = parseFloat(scoreText) || null;

      const yearText = $('div.infos span').eq(1).text();
      const year = parseInt(yearText) || null;

      const tags = [];
      $('span.gen a').each((i, el) => tags.push($(el).text().trim()));

      // Extract poster
      let posterUrl = '';
      let playerUrl = isSeries ? $('div.listagem li a').first().attr('href') : (url.includes('?') ? `${url}&area=online` : `${url}/?area=online`);

      if (playerUrl) {
        playerUrl = fixUrl(playerUrl);
        try {
          const styleRes = await axios.get(playerUrl, { headers });
          const $style = cheerio.load(styleRes.data);
          const style = $style('div#video_embed').attr('style') || '';
          const match = style.match(/url\((.*?)\)/);
          if (match) {
            posterUrl = match[1].replace(/['"]/g, '').replace('w1280', 'original');
            posterUrl = fixUrl(posterUrl);
          }
        } catch (e) { }
      }

      if (!posterUrl) {
        let fallback = $('div.vb_image_container').attr('data-background-src');
        if (fallback) {
          posterUrl = fixUrl(fallback.replace('w185', 'original'));
        }
      }

      if (isSeries) {
        const seasonsSet = new Set();
        $('script').each((i, el) => {
          const data = $(el).html();
          if (data && data.includes('DOMContentLoaded')) {
            const regex = /<li onclick='load\((\d+)\);'>/g;
            let match;
            while ((match = regex.exec(data)) !== null) {
              seasonsSet.add(parseInt(match[1]));
            }
          }
        });

        const episodes = [];
        for (const season of Array.from(seasonsSet)) {
          const seasonUrl = url.includes('?') ? `${url}&temporada=${season}` : `${url}?temporada=${season}`;
          try {
            const seasonRes = await axios.get(seasonUrl, { headers });
            const $s = cheerio.load(seasonRes.data);
            $s('div.listagem li').each((i, ep) => {
              const href = $s(ep).find('a').first().attr('href');
              const dataId = $s(ep).attr('data-id') || '';
              const epIdStr = dataId.replace(new RegExp(`^${season}`), '');
              const epNum = parseInt(epIdStr) || 0;

              if (href) {
                episodes.push({
                  season: season,
                  episode: epNum,
                  name: `Episódio ${epNum}`,
                  data: `series|${fixUrl(href)}`
                });
              }
            });
          } catch (e) { }
        }

        return {
          name: title, url, type: 'TvSeries', posterUrl, plot, year, tags, score, duration, episodes
        };
      } else {
        return {
          name: title, url, type: 'Movie', posterUrl, plot, year, tags, score, duration,
          dataUrl: `movie|${url}`
        };
      }

    } catch (e) {
      console.error('Erro no load PobreFlix', e);
      throw e;
    }
  },

  async loadLinks(data) {
    const [type, rawUrl] = data.split('|', 2);
    const actualUrl = rawUrl || data;

    let url = actualUrl;
    if (type === 'movie') {
      url = actualUrl.includes('?') ? `${actualUrl}&area=online` : `${actualUrl}/?area=online`;
    }

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const finalLinks = [];
      const BASE_PLAYER = `${BASE_URL}/e/getplay.php`;

      const playItems = $('div.item[onclick*="C_Video"]').get();

      for (const item of playItems) {
        const onClick = $(item).attr('onclick') || '';
        const match = onClick.match(/C_Video\('(\d+)','(.*?)'\)/);

        if (match) {
          const id = match[1];
          const server = match[2].toLowerCase();
          const playUrl = `${BASE_PLAYER}?id=${id}&sv=${server}`;

          try {
            const playRes = await axios.get(playUrl, {
              headers: { ...headers, Referer: url }
            });

            // O servidor PHP retorna um redirecionamento ou iframe
            // Em axios, redirecionamentos são seguidos automaticamente.
            const finalPlayUrl = playRes.request.res.responseUrl;

            if (finalPlayUrl && finalPlayUrl !== playUrl && !finalPlayUrl.includes('pobreflixtv')) {
              let correctedUrl = finalPlayUrl;
              if (correctedUrl.includes('streamtape.com/v/')) {
                correctedUrl = correctedUrl.replace('/v/', '/e/');
              }

              finalLinks.push({
                name: `PobreFlix - ${server}`,
                url: correctedUrl,
                quality: 'Auto'
              });
            } else {
              // Se não redirecionou, podemos inspecionar o HTML para pegar o iframe real
              const $play = cheerio.load(playRes.data);
              const iframeSrc = $play('iframe').attr('src');
              if (iframeSrc && !iframeSrc.includes('pobreflixtv')) {
                finalLinks.push({
                  name: `PobreFlix - ${server}`,
                  url: iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc,
                  quality: 'Auto'
                });
              }
            }
          } catch (e) { }
        }
      }

      return finalLinks;
    } catch (e) {
      console.error('Erro no loadLinks PobreFlix', e);
      return [];
    }
  }
};
