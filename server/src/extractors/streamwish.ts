import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';
import JsUnpacker from '@utils/jsUnpacker';

export default createExtractor((api) => ({
  name: 'Streamwish',
  domains: [
    'mwish.pro', 'dwish.pro', 'embedwish.com', 'wishembed.pro', 'kswplayer.info',
    'wishfast.top', 'streamwish.site', 'sfastwish.com', 'strwish.xyz', 'strwish.com',
    'flaswish.com', 'awish.pro', 'obeywish.com', 'jodwish.com', 'swhoi.com',
    'multimovies.cloud', 'uqloads.xyz', 'doodporn.xyz', 'cdnwish.com', 'asnwish.com',
    'nekowish.my.id', 'neko-stream.click', 'swdyu.com', 'wishonly.site', 'playerwish.com',
    'streamhls.to', 'hlswish.com', 'streamwish.to', 'streamwish.com'
  ],

  async extract(url: string, referer?: string): Promise<StreamLink[] | null> {
    try {
      // 1. Resolve Embed URL (Kotlin logic)
      let targetUrl = url;
      if (url.includes('/f/')) {
        targetUrl = url.replace(/\/f\/([a-zA-Z0-9]+)/, '/e/$1');
      } else if (url.includes('/v/')) {
        targetUrl = url.replace(/\/v\/([a-zA-Z0-9]+)/, '/e/$1');
      }

      const mainUrl = new URL(targetUrl).origin;

      const headers = {
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': `${mainUrl}/`,
        'Origin': `${mainUrl}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      const res = await api.request.get(targetUrl, {
        headers: {
          ...headers,
          'Referer': referer || targetUrl,
        }
      });

      const html = res.data;
      console.log(`[Streamwish] HTML recebido (tamanho): ${html.length}`);
      const $ = api.html.parse(html);

      let playerScriptData = '';

      // 1. Tenta desempacotar se o script usar eval(function(p,a,c,k,e,d))
      const packedMatch = html.match(/eval\s*\((function\s*\(p,a,c,k,e,d\)[\s\S]+?)\)\s*;?\s*<\/script>/i);

      if (packedMatch && packedMatch[1]) {
        console.log('[Streamwish] Script empacotado encontrado.');
        const unpacker = new JsUnpacker(packedMatch[1]);
        playerScriptData = unpacker.unpack() || '';
        console.log(`[Streamwish] JS desempacotado (tamanho): ${playerScriptData.length}`);
      }
      // 2. Busca scripts normais declarando o player se não estiver empacotado
      else {
        console.log('[Streamwish] Buscando scripts normais...');
        $('script').each((_, el) => {
          const scriptContent = $(el).html() || '';
          if (scriptContent.includes('jwplayer("vplayer").setup(') || scriptContent.includes('sources:')) {
            playerScriptData += scriptContent;
          }
        });
      }

      if (!playerScriptData) {
        playerScriptData = html;
      }

      // Procura a URL de vídeo (m3u8 ou mp4) no JS desempacotado ou no setup do player
      const m3u8Match = 
        playerScriptData.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
        playerScriptData.match(/src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
        playerScriptData.match(/["']?file["']?\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);

      if (m3u8Match && m3u8Match[1]) {
        console.log(`[Streamwish] Link encontrado: ${m3u8Match[1]}`);
        const streamUrl = m3u8Match[1].replace(/\\\//g, '/');

        return [{
          name: 'Streamwish',
          url: streamUrl,
          quality: 'Auto',
          type: streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
          referer: targetUrl,
          headers: headers
        }];
      }

      return null;
    } catch (e: any) {
      console.error('[Streamwish] Extração falhou:', e.message);
      return null;
    }
  }
}));
