import type { StreamLink } from '@shared/types';
import { createExtractor } from '@plugin-api';
import JsUnpacker from '../utils/jsUnpacker';

export default createExtractor((api) => ({
  name: 'FileMoon',
  domains: ['filemoon.sx', 'filemoon.to', 'filemoon.in', 'filemoon.net'],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const defaultHeaders = {
        'Referer': url,
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0'
      };

      // 1. Initial Request
      const res = await api.request.get(url, { headers: defaultHeaders });
      let htmlToProcess = res.data;

      // 2. Look for iframe using api.html (Cheerio)
      const $ = api.html.parse(htmlToProcess);
      const iframeSrc = $('iframe').attr('src');

      // 3. If iframe exists, fetch it
      if (iframeSrc) {
        const iframeHeaders = { ...defaultHeaders, 'Accept-Language': 'en-US,en;q=0.5' };
        const iframeRes = await api.request.get(iframeSrc, { headers: iframeHeaders });
        htmlToProcess = iframeRes.data;
      }

      // 4. Extract packed script
      const $$ = api.html.parse(htmlToProcess);
      let packedScript = '';

      $$('script').each((_i, el) => {
        const scriptContent = $$(el).html();
        if (scriptContent && scriptContent.includes('function(p,a,c,k,e,d)')) {
          packedScript = scriptContent;
        }
      });

      if (!packedScript) {
        console.warn('Packed script not found in FileMoon page.');
        return [];
      }

      // 5. Unpack content
      const unpacker = new JsUnpacker(packedScript);
      const unpacked = unpacker.unpack();

      if (!unpacked) return [];

      // 6. Regex to find stream file
      const fileRegex = /sources\s*:\s*\[\s*\{\s*file\s*:\s*["'](.*?)["']/;
      const match = unpacked.match(fileRegex);

      if (match && match[1]) {
        return [{
          name: 'FileMoon Direct',
          url: match[1],
          quality: 'Auto',
          type: 'hls',
          referer: url
        }];
      }

    } catch (e: any) {
      console.error('FileMoon extraction error:', e.message);
    }

    return [];
  }
}));
