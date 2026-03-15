import { createPlugin } from '@plugin-api';
import type { Episode, HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

const BASE_URL = "https://megaflix.lat";
const LANG = "pt-br";
const UA_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36" };

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    const categories = [
      { url: "/genero/acao", name: "Ação" },
      { url: "/genero/animacao", name: "Animação" },
      { url: "/genero/comedia", name: "Comédia" },
      { url: "/genero/crime", name: "Crime" },
      { url: "/genero/documentario", name: "Documentário" },
      { url: "/genero/drama", name: "Drama" },
      { url: "/genero/sci-fi", name: "Sci-fi" }
    ];

    const sections: HomeSection[] = [];

    for (const cat of categories) {
      try {
        const url = `${BASE_URL}${cat.url}/1`;
        const res = await api.request.get(url, { headers: { ...UA_HEADERS, Cookie: "ordem=3" } });
        const $ = api.html.parse(res.data);
        const list: MediaItem[] = [];

        $('div.col-lg-2 > a').each((_, el) => {
          const $el = $(el);
          const link = $el.attr('href') || $el.find('a').attr('href');
          if (!link) return;

          let title = $el.find('h3.title').text().trim();
          if (!title) return;

          let posterUrl = $el.find('picture img').attr('data-src') || $el.find('img').attr('data-src') || "";
          if (!posterUrl.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)$/i)) return; // Filters invalid images

          if (posterUrl.startsWith('/')) posterUrl = `${BASE_URL}${posterUrl}`;

          const isMovie = link.includes('filme');
          
          list.push({
            name: title,
            url: link.startsWith('http') ? link : `${BASE_URL}${link}`,
            type: isMovie ? 'Movie' : 'TvSeries',
            posterUrl: posterUrl,
          });
        });

        if (list.length > 0) {
          sections.push({ name: cat.name, list });
        }
      } catch (err) {
        // Ignorar falhas unitarias
      }
    }

    return sections;
  },

  async search(query: string): Promise<MediaItem[]> {
    const url = `${BASE_URL}/procurar/${encodeURIComponent(query)}`;
    const res = await api.request.get(url, { headers: UA_HEADERS });
    const $ = api.html.parse(res.data);
    const results: MediaItem[] = [];

    $('div.col-lg-2 > a').each((_, el) => {
      const $el = $(el);
      const link = $el.attr('href') || $el.find('a').attr('href');
      if (!link) return;

      let title = $el.find('h3.title').text().trim();
      if (!title) return;

      let posterUrl = $el.find('img').attr('src') || "";
      if (!posterUrl.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)$/i)) return;

      if (posterUrl.startsWith('/')) posterUrl = `${BASE_URL}${posterUrl}`;

      const isMovie = link.includes('filme');

      results.push({
        name: title,
        url: link.startsWith('http') ? link : `${BASE_URL}${link}`,
        type: isMovie ? 'Movie' : 'TvSeries',
        posterUrl: posterUrl
      });
    });

    return results;
  },

  async load(url: string): Promise<MediaDetails> {
    const res = await api.request.get(url, { headers: UA_HEADERS });
    const $ = api.html.parse(res.data);

    const isTvSeries = !url.includes('filme');

    const title = $('h1.h3.mb-1').first().text().trim() || "Sem Título";
    const plot = $('p.fs-sm.text-muted').text().trim();
    
    let scoreText = $('div.text-imdb > span').text().trim();
    let score = scoreText ? parseFloat(scoreText) : undefined;
    
    let yearText = $('li.list-inline-item').first().text().trim();
    let year = yearText ? parseInt(yearText) : undefined;

    let posterUrl = $('img.img-fluid').attr('src') || "";
    if (posterUrl.startsWith('/')) posterUrl = `${BASE_URL}${posterUrl}`;

    if (isTvSeries) {
      const seasonsInfo: { seasonNum: number; itemId: string }[] = [];
      const seasonNumbers: number[] = [];

      $('div.card-season div.accordion-item div.select-season').each((_, el) => {
         const sNumText = $(el).attr('data-season') || "";
         const item = $(el).attr('data-item') || "";
         const sNum = parseInt(sNumText);
         
         if (sNum && sNum > 0 && item) {
            seasonsInfo.push({ seasonNum: sNum, itemId: item });
            if (!seasonNumbers.includes(sNum)) seasonNumbers.push(sNum);
         }
      });

      const urlMatch = url.match(/.*\/assistir\/([^/]+)[/?]?/);
      const itemIdUrl = urlMatch ? urlMatch[1] : "";

      const episodes: Episode[] = [];

      // Fetch all seasons sequentialy or parallel
      for (const season of seasonsInfo) {
         try {
           const seasonFormData = new URLSearchParams();
           seasonFormData.append("season", season.seasonNum.toString());
           seasonFormData.append("item_id", season.itemId);
           seasonFormData.append("item_url", itemIdUrl);

           const seasonRes = await api.request.post(`${BASE_URL}/api/seasons`, seasonFormData.toString(), {
              headers: { ...UA_HEADERS, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
           });

           const htmlData = typeof seasonRes.data === 'string' ? seasonRes.data : seasonRes.data.html || JSON.stringify(seasonRes.data);
           const $s = api.html.parse(htmlData);

           $s('div.card-episode').each((_, epEl) => {
              const $ep = $s(epEl);
              const epA = $ep.find('a.episode');
              const href = epA.attr('href') || "";
              
              const epNumMatch = epA.text().match(/(\d+)/);
              const epNum = epNumMatch ? parseInt(epNumMatch[1]) : 1;

              const epName = $ep.find('a.name').text().trim() || `Episódio ${epNum}`;

              episodes.push({
                 name: epName,
                 season: season.seasonNum,
                 episode: epNum,
                 data: href.startsWith('http') ? href : `${BASE_URL}${href}`
              });
           });
         } catch(e) {
           console.error("Error fetching season", season.seasonNum, e);
         }
      }

      return {
        name: title,
        url: url,
        type: 'TvSeries',
        posterUrl: posterUrl,
        plot: plot,
        year: year,
        score: score,
        seasons: seasonNumbers,
        episodes: episodes
      };
    } else {
       // Movie
       const players: string[] = [];
       $('ul.players li a').each((_, el) => {
          const dataUrl = $(el).attr('data-url');
          if (dataUrl) players.push(dataUrl);
       });

       return {
         name: title,
         url: url,
         type: 'Movie',
         posterUrl: posterUrl,
         plot: plot,
         year: year,
         score: score,
         dataUrl: JSON.stringify(players)
       };
    }
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    const finalLinks: StreamLink[] = [];

    const loadExtractorFor = async (u: string) => {
       const cleanUrl = u.replace("https://megafrixapi.com/blog/index.php?link=", "");
       // Assuming it goes back to the api logic which delegates to MegafrixApi extractor or global extractors
       // So we just return it here for the main api wrapper to handle or as an embed
       finalLinks.push({
          name: "MegaFlix / Video Link",
          url: cleanUrl,
          quality: "Auto",
          referer: BASE_URL
       });
    };

    if (data.startsWith('http')) {
      try {
         const res = await api.request.get(data, { headers: UA_HEADERS });
         const $ = api.html.parse(res.data);
         $('ul.players li a').each((_, el) => {
            const dataUrl = $(el).attr('data-url');
            if (dataUrl) {
                // To avoid async map, we just push raw urls. They would be extracted later if domains match.
                let cleanUrl = dataUrl.replace("https://megafrixapi.com/blog/index.php?link=", "");
                finalLinks.push({
                   name: "MegaFlix Source",
                   url: cleanUrl,
                   quality: "Auto"
                });
            }
         });
      } catch(e) {}
    } else {
       try {
         const parsedUrls: string[] = JSON.parse(data);
         for(const u of parsedUrls) {
            let cleanUrl = u.replace("https://megafrixapi.com/blog/index.php?link=", "");
            finalLinks.push({
               name: "MegaFlix / Video Link",
               url: cleanUrl,
               quality: "Auto"
            });
         }
       } catch (e) {
         // data must be a single string without '[' around if it is an episode?
         // in episode, `data` is the href of the episode. So data.startsWith('http') handles it.
       }
    }

    return finalLinks;
  }
}));
