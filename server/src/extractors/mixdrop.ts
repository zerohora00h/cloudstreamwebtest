import type { StreamLink } from '@shared/types';
import { createExtractor } from '@plugin-api';
import JsUnpacker from '../utils/jsUnpacker';

export default createExtractor((api) => ({
  name: 'MixDrop',
  domains: [
    'mixdrop.co', 'mixdrop.to', 'mixdrop.sx', 'mixdrop.bz', 'mixdrop.ch',
    'mixdrop.ag', 'mixdrop.gl', 'mixdrop.ps', 'm1xdrop.bz', 'mdy48tn97.com',
    'mxdrop.to', 'mixdrop.si'
  ],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const embedUrl = url.replace('/f/', '/e/');
      const res = await api.request.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = res.data;
      let unpackedText = html;

      // 1. Isolate packed script
      const packedScriptMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\).*?\)\)/);

      if (packedScriptMatch) {
        const unpacker = new JsUnpacker(packedScriptMatch[0]);
        const result = unpacker.unpack();
        if (result && result !== packedScriptMatch[0]) {
          unpackedText = result;
        }
      }

      // 2. Regex for video URL
      const srcRegex = /wurl.*?=.*?"(.*?)";?/;
      const match = unpackedText.match(srcRegex);

      if (match && match[1]) {
        let videoUrl = match[1];

        if (videoUrl.startsWith('//')) {
          videoUrl = `https:${videoUrl}`;
        }

        return [{
          name: 'MixDrop Direct',
          url: videoUrl,
          quality: 'Auto',
          type: 'mp4',
          referer: url
        }];
      }
    } catch (e: any) {
      console.error('MixDrop extraction error:', e.message);
    }
    return [];
  }
}));
