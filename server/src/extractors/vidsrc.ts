import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';

export default createExtractor((api) => ({
  name: 'VidSrc',
  domains: ['vsembed.ru', 'vsembed.top'],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vsembed.ru/'
      };

      // 1. Get the embed page to find the hash
      const res = await api.request.get(url, { headers });
      const $ = api.html.parse(res.data);
      
      // Look for any element with data-hash
      let hash = $('[data-hash]').first().attr('data-hash');

      if (!hash) {
        const hashMatch = res.data.match(/data-hash="([^"]+)"/);
        hash = hashMatch ? hashMatch[1] : null;
      }

      if (!hash) {
        throw new Error('Could not find data-hash for VidSrc');
      }

      // 2. Get the Cloudnestra iframe content (rcp)
      const cloudnestraUrl = `https://cloudnestra.com/rcp/${hash}`;
      const cloudRes = await api.request.get(cloudnestraUrl, {
        headers: {
          ...headers,
          'Referer': url
        }
      });

      // 3. Try to find the M3U8 link in the Cloudnestra page or find "prorcp"
      let m3u8Match = cloudRes.data.match(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/) ||
                      cloudRes.data.match(/"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/);

      let prorcpRes;
      if (!m3u8Match) {
         const prorcpMatch = cloudRes.data.match(/prorcp\/([^"']+)/) || 
                             cloudRes.data.match(/\/prorcp\/([^"']+)/);
         
         if (prorcpMatch) {
            const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpMatch[1]}`;
            prorcpRes = await api.request.get(prorcpUrl, {
               headers: {
                  ...headers,
                  'Referer': cloudnestraUrl
               }
            });

            // prorcp returns HTML, we search for the file link inside it
            const htmlData = prorcpRes.data;
            m3u8Match = htmlData.match(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/) ||
                        htmlData.match(/"file"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/) ||
                        htmlData.match(/sources\s*:\s*\[{.*?file\s*:\s*"(.*?)"/);
         }
      }

      if (!m3u8Match) {
         return null;
      }

      let streamUrl = (m3u8Match[1] || m3u8Match[2]).replace(/\\\//g, '/');

      // 5. Replace placeholders {v1} to {v5}
      // These values are usually in a global 'v' object or variables qr1, qr2...
      for (let i = 1; i <= 5; i++) {
        const placeholder = `{v${i}}`;
        if (streamUrl.includes(placeholder)) {
          const qrRegex = new RegExp(`["']?qr${i}["']?\\s*[:=]\\s*["']([^"']+)["']`);
          const qrMatch = res.data.match(qrRegex) ||
                          cloudRes.data.match(qrRegex) ||
                          (prorcpRes?.data && typeof prorcpRes.data === 'string' && prorcpRes.data.match(qrRegex));
          
          if (qrMatch) {
            let val = qrMatch[1];
            if (val.startsWith('js:')) val = val.substring(3); 
            streamUrl = streamUrl.replace(new RegExp(placeholder, 'g'), val);
          } else if (i === 1) {
            // Fallback for v1 which we identified as current active domain
            streamUrl = streamUrl.replace(new RegExp(placeholder, 'g'), 'neonhorizonworkshops.com');
          }
        }
      }

      return [{
        name: 'VidSrc',
        url: streamUrl,
        quality: 'Auto',
        type: 'hls',
        referer: 'https://cloudnestra.com/'
      }];

    } catch (error: any) {
      console.error('VidSrc Extractor Error:', error.message);
      return null;
    }
  }
}));
