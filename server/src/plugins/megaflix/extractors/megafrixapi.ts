import type { StreamLink } from '@shared/types';
import { createExtractor } from '@plugin-api';

export default createExtractor((api) => ({
  name: 'MegaFrixApi',
  domains: ['megafrixapi.com'],

  async extract(url: string, referer?: string): Promise<StreamLink[] | null> {
    try {
      const res = await api.request.get(url, { headers: { Referer: referer || url } });
      const html = res.data;
      const $ = api.html.parse(html);
      
      const links: StreamLink[] = [];

      // Typically MegaFrixApi wraps standard players or exposes mp4/m3u8 sources directly
      const videoSrc = $('video source').attr('src') || $('video').attr('src');
      const iframeSrc = $('iframe').attr('src');

      if (videoSrc) {
        links.push({
          name: 'MegaFrix Direct',
          url: videoSrc,
          quality: 'Auto',
          type: videoSrc.includes('.m3u8') ? 'hls' : 'mp4',
          referer: url
        });
      } else if (iframeSrc) {
         // Se for iframe de video hoster (Ex: filemoon, streamtape), apenas retorna a URL do iframe
         // A Global API irá repassar pro Extrator responsável depois se necessário
         let fUrl = iframeSrc;
         if (fUrl.startsWith('//')) fUrl = `https:${fUrl}`;
         links.push({
          name: 'MegaFrix Embed',
          url: fUrl,
          quality: 'Auto',
          referer: url
        });
      } else {
         // Procura regex no JS como fallback
         const scriptMatch = html.match(/file\s*:\s*["'](.*?)["']/);
         if (scriptMatch && scriptMatch[1]) {
            links.push({
              name: 'MegaFrix Direct',
              url: scriptMatch[1],
              quality: 'Auto',
              type: scriptMatch[1].includes('.m3u8') ? 'hls' : 'mp4',
              referer: url
            });
         }
      }

      return links.length ? links : null;

    } catch (e: any) {
       console.error('MegaFrixApi extraction error:', e.message);
       return null;
    }
  }
}));
