import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';
import JsUnpacker from '@utils/jsUnpacker';

export default createExtractor((api) => ({
  name: 'Fsplay',
  domains: ['112234152.xyz', '/player/'],

  async extract(url: string, referer?: string): Promise<StreamLink[] | null> {
    try {
      // 1. Adicionado User-Agent e Accept para evitar bloqueios 403/Cloudflare
      const res = await api.request.get(url, {
        headers: {
          'Referer': referer || url,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
      });
      const html = res.data;

      if (!html) {
        console.error('Fsplay: O HTML retornado está vazio. Possível bloqueio.');
        return null;
      }

      const baseUrlMatch = html.match(/var\s+player_base_url\s*=\s*["']([^"']+)["']/i);
      const baseUrl = baseUrlMatch ? baseUrlMatch[1] : '';

      // 2. Substituído o `.+?` com flag `/s` por `[\s\S]+?` para compatibilidade universal de Regex
      const packedJsMatch = html.match(/eval\s*\((function\s*\(p,a,c,k,e,d\)[\s\S]+?)\)\s*;?\s*<\/script>/i);

      if (!packedJsMatch || !packedJsMatch[1]) {
        console.error('Fsplay: JS empacotado (eval) não encontrado no HTML.');
        return null;
      }

      const packedJs = packedJsMatch[1];
      const unpacker = new JsUnpacker(packedJs);
      const unpacked = unpacker.unpack();

      if (!unpacked) {
        console.error('Fsplay: Falha ao desempacotar o JS.');
        return null;
      }

      // 3. Regex de m3u8 mais flexível (suporta aspas simples, duplas e múltiplos campos)
      const m3u8Match = 
        unpacked.match(/videoUrl\s*[:=]\s*["']([^"']+)["']/i) || 
        unpacked.match(/["']?file["']?\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
        unpacked.match(/["']([^"']+\.m3u8[^"']*)["']/i);
        
      const m3u8Path = m3u8Match ? m3u8Match[1] : null;

      if (!m3u8Path) {
        // Fallback: Procura qualquer coisa que pareça um link m3u8/mp4 no JS todo
        const fallbackMatch = unpacked.match(/["'](http[^"']+\.(?:m3u8|mp4|hls|txt)[^"']*)["']/i);
        if (fallbackMatch) {
            return [{
                name: 'Fsplay Direct (Fallback)',
                url: fallbackMatch[1].replace(/\\\//g, '/'),
                quality: 'Auto',
                type: fallbackMatch[1].includes('.m3u8') ? 'hls' : 'mp4',
                referer: url
            }];
        }

        console.error('Fsplay: Caminho M3U8 não encontrado no JS desempacotado.');
        return null;
      }

      const cleanPath = m3u8Path.replace(/\\\//g, '/');
      const finalM3u8 = cleanPath.startsWith('http')
        ? cleanPath
        : `${baseUrl.replace(/\/$/, '')}/${cleanPath.replace(/^\//, '')}`;

      return [{
        name: 'Fsplay Direct',
        url: finalM3u8,
        quality: 'Auto',
        type: 'hls',
        referer: url
      }];
    } catch (e: any) {
      console.error('Fsplay extraction error:', e.message);
      return null;
    }
  }
}));