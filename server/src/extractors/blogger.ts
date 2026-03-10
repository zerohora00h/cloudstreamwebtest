import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';

export default createExtractor((api) => ({
  name: 'Blogger',
  domains: ['blogger.com', 'www.blogger.com'],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      // 1. Fazemos a requisição e capturamos os Cookies de sessão
      const res = await api.request.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://www.blogger.com/'
        }
      });

      const html = res.data;
      if (!html) return null;

      // Pegamos o cookie 'NID' ou 'HSID' se o Google tiver enviado (opcional mas ajuda)
      const cookies = res.headers['set-cookie']?.join('; ') || '';

      const links: StreamLink[] = [];

      // 2. BUSCA NO BLOCO IJ_values (Onde o Google agora guarda o link de inicialização)
      // No seu HTML: 'https:\/\/www.blogger.com\/video.g?token%3DAD6v5dw...'
      const ijMatch = html.match(/https?%?3A%?2F%?2Fwww\.blogger\.com%?2Fvideo\.g%?3Ftoken%?3D([^"&'\\]+)/)
        || html.match(/video\.g\?token[=%]3D([^&"'\\]+)/);

      if (ijMatch) {
        const token = decodeURIComponent(ijMatch[1]);

        // O link .g?token=... é mais estável que o .mp4
        const videoUrl = `https://www.blogger.com/video.g?token=${token}`;

        console.log(`[Blogger] Token WIZ encontrado. Gerando link de fluxo.`);

        links.push({
          name: 'Blogger (HD)',
          url: videoUrl,
          quality: 'Auto',
          headers: {
            'Referer': url, // Importante: O referer deve ser a URL original do vídeo
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Cookie': cookies // Repassamos os cookies da sessão para evitar o 404
          }
        });
      }

      // 3. SEGUNDA TENTATIVA: Scraper de emergência (Caso o WIZ tenha injetado a URL bruta)
      const rawMatch = html.match(/https?:\/\/[^"'\s\\]+?\.googleusercontent\.com\/videoplayback[^"'\s\\]+/g);
      if (rawMatch) {
        for (const raw of rawMatch) {
          const clean = raw.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          if (!links.some(l => l.url === clean)) {
            links.push({
              name: 'Blogger (Direct)',
              url: clean,
              quality: clean.includes('itag=22') ? '720p' : '360p',
              headers: { 'Referer': 'https://www.youtube.com/' }
            });
          }
        }
      }

      console.log(`[Blogger] Extração finalizada com ${links.length} links.`);
      return links.length > 0 ? links : null;

    } catch (e: any) {
      console.error('Blogger extraction error:', e.message);
      return null;
    }
  }
}));