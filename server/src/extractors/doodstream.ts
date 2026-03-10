import type { StreamLink } from '@shared/types';
import { createExtractor } from '@plugin-api';

export default createExtractor((api) => ({
  name: 'DoodStream',
  domains: ['dood.to', 'dood.so', 'dood.la', 'dood.wf', 'doodstream.com', 'ds2play.com', 'myvidplay.com'],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const res = await api.request.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = res.data;

      // Regex for pass_md5 link
      const md5Match = html.match(/\/pass_md5\/[^'"]*/);

      if (md5Match) {
        const md5Url = `https://dood.so${md5Match[0]}`;
        const md5Res = await api.request.get(md5Url, {
          headers: { 'Referer': url }
        });

        let videoUrl = md5Res.data;
        // Append random characters as DoodStream usually requires
        videoUrl += '7777777777?token=' + md5Url.split('/').pop() + '&expiry=' + Date.now();

        return [{
          name: 'Dood Direct',
          url: videoUrl,
          quality: 'Auto',
          type: 'mp4',
          referer: url
        }];
      }
    } catch (e: any) {
      console.error('DoodStream extraction error:', e.message);
    }
    return [];
  }
}));
