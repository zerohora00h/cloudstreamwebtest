const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://www.anroll.net';
const episodeUrl = 'https://apiv3-prd.anroll.net';
const posterBaseUrl = 'https://static.anroll.net';
const videoBaseUrl = 'https://cdn-zenitsu-2-gamabunta.b-cdn.net';

module.exports = {
  async getHome() {
    const homeData = [];
    try {
      // Fetching animes
      const animeRes = await axios.get(`${episodeUrl}/animes?page=1&gen=todos&alpha=az`);
      const animeItems = (animeRes.data?.data || []).map(item => ({
        name: item.titulo?.trim(),
        url: `${mainUrl}/a/${item.generate_id?.trim()}`,
        type: 'TvSeries',
        posterUrl: `${posterBaseUrl}/images/animes/capas/${item.slug_serie?.trim()}.jpg`
      }));
      homeData.push({ name: 'Animes - Todos', list: animeItems });

      // Fetching movies (from Next.js data)
      const filmesUrl = 'https://www.anroll.net/_next/data/RWySOXkJe1_j6zQD6H8T_/filmes.json';
      const filmesRes = await axios.get(filmesUrl);
      const filmeItems = (filmesRes.data?.pageProps?.data?.data_movies || []).map(item => ({
        name: item.nome_filme?.trim(),
        url: `${mainUrl}/f/${item.generate_id?.trim()}`,
        type: 'Movie',
        posterUrl: `${posterBaseUrl}/images/filmes/capas/${item.slug_filme?.trim()}.jpg`
      }));
      homeData.push({ name: 'Filmes - Todos', list: filmeItems });

    } catch (e) {
      console.error('Error fetching Anroll home:', e.message);
    }
    return homeData;
  },

  async search(query) {
    try {
      const res = await axios.get(`https://api-search.anroll.net/data?q=${encodeURIComponent(query)}`);
      return (res.data?.data || []).map(item => {
        const isMovie = item.type === 'movie';
        const slug = item.slug?.trim();
        return {
          name: item.title,
          url: isMovie ? `${mainUrl}/f/${item.gen_id}` : `${mainUrl}/a/${item.gen_id}`,
          type: isMovie ? 'Movie' : 'TvSeries',
          posterUrl: isMovie ? `${posterBaseUrl}/images/filmes/capas/${slug}.jpg` : `${posterBaseUrl}/images/animes/capas/${slug}.jpg`,
          year: parseInt(item.year) || null
        };
      });
    } catch (e) {
      return [];
    }
  },

  async load(url) {
    const isMovie = url.includes('/f/');
    if (isMovie) {
      const genId = url.split('/').pop();
      const movieApiUrl = `https://www.anroll.net/_next/data/RWySOXkJe1_j6zQD6H8T_/f/${genId}.json?movie=${genId}`;
      const res = await axios.get(movieApiUrl);
      const movieData = res.data?.pageProps?.data?.data_movie;

      return {
        name: movieData?.nome_original || movieData?.nome_filme,
        url,
        type: 'Movie',
        posterUrl: `${posterBaseUrl}/images/filmes/capas/${movieData?.slug_filme?.trim()}.jpg`,
        plot: movieData?.sinopse_filme,
        year: parseInt(movieData?.ano) || null,
        dataUrl: url
      };
    } else {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);

      const title = $('article.animedetails h2').text().trim();
      const poster = $('section.animecontent img').attr('src') || `${posterBaseUrl}/images/animes/capas/${url.split('/').pop()}.jpg`;
      const description = $('div.sinopse').text().trim();
      const tags = $('div#generos a').map((i, el) => $(el).text().trim()).get();

      const episodes = [];
      const baseId = url.split('/').pop();
      const firstEpPage = await axios.get(`${episodeUrl}/animes/${baseId}/episodes?page=1&order=asc`);
      const totalPages = firstEpPage.data?.meta?.totalOfPages || 1;

      const mapEpisodes = (data) => {
        return (data || []).map(ep => ({
          name: ep.titulo_episodio,
          url: JSON.stringify({ slug: ep.anime?.slug_serie, n: ep.n_episodio, type: 'animes' }),
          episode: parseInt(ep.n_episodio),
          posterUrl: `${posterBaseUrl}/images/animes/screens/${ep.anime?.slug_serie}/${ep.n_episodio.padStart(3, '0')}.jpg`,
          data: JSON.stringify({ slug: ep.anime?.slug_serie, n: ep.n_episodio, type: 'animes' })
        }));
      };

      episodes.push(...mapEpisodes(firstEpPage.data?.data));

      for (let p = 2; p <= totalPages && p <= 5; p++) { // Limiting pages for safety in this phase
        const pRes = await axios.get(`${episodeUrl}/animes/${baseId}/episodes?page=${p}&order=asc`);
        episodes.push(...mapEpisodes(pRes.data?.data));
      }

      return {
        name: title,
        url,
        type: 'TvSeries',
        posterUrl: poster,
        plot: description,
        tags,
        episodes
      };
    }
  },

  async loadLinks(data) {
    if (data.startsWith('http')) {
      // Movie handling
      const genId = data.split('/').pop();
      const movieApiUrl = `https://www.anroll.net/_next/data/RWySOXkJe1_j6zQD6H8T_/f/${genId}.json?movie=${genId}`;
      const res = await axios.get(movieApiUrl);
      const slug = res.data?.pageProps?.data?.data_movie?.slug_filme;
      if (!slug) return [];

      const streamUrl = `${videoBaseUrl}/cf/hls/movies/${slug}/movie.mp4/media-1/stream.m3u8`;
      return [{ name: 'Anroll Player', url: streamUrl, type: 'm3u8' }];
    }

    try {
      const load = JSON.parse(data);
      const streamUrl = `${videoBaseUrl}/cf/hls/${load.type}/${load.slug}/${load.n}.mp4/media-1/stream.m3u8`;
      return [{ name: 'Anroll Player', url: streamUrl, type: 'm3u8' }];
    } catch (e) {
      return [];
    }
  }
};
