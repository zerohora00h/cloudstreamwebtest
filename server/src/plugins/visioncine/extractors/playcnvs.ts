import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';

// Fixed internal ID from Kotlin source
const INTERNAL_DRM_ID = "pygrp_KJp_cyHo0.lbp-kBz.mo52lYEgGDK1tDG9tb_9GXI_";

function getAppConfigToken(): string {
  const os = 5;
  const stdArr = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 38, 42];
  const std = stdArr.map(c => String.fromCharCode(c + os)).join("");

  const op = 3;
  const tpArr = [119, 62, 117, 63, 118, 64, 116, 65, 115, 66, 114, 67, 113, 68, 112, 69, 111, 70, 110, 71, 109, 72, 108, 73, 107, 75, 106, 74, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 40, 42, 92, 87, 85, 86, 84, 43, 39, 30, 33, 32, 34, 35];
  const tp = tpArr.map(c => String.fromCharCode(c + op)).join("");

  let sb = "";
  for (let c of INTERNAL_DRM_ID) {
    let i = tp.indexOf(c);
    if (i !== -1 && i < std.length) {
      sb += std[i];
    } else {
      if (c === '!') sb += '+';
      else if (c === '$') sb += '/';
      else sb += c;
    }
  }

  let buffer = sb;
  while (buffer.length % 4 !== 0) buffer += "=";
  return Buffer.from(buffer, 'base64').toString('utf8').trim();
}

export default createExtractor((api) => ({
  name: 'PlayCNVS',
  domains: ['playcnvs.stream', 'cnvsweb.stream', 'vsutx.com'],

  async extract(url: string): Promise<StreamLink[] | null> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': getAppConfigToken(),
      'Referer': 'https://www.visioncine-1.com.br/'
    };

    try {
      const res = await api.request.get(url, { headers });
      const $ = api.html.parse(res.data);

      const scripts = $('script').map((i, el) => $(el).html()).get().join('\n');

      const patterns = [
        /initializePlayerWithSubtitle\(['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"],\s*['"]([^'"]*\.srt[^'"]*)['"]/,
        /initializePlayer\(['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /file:\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /src:\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/,
        /["']?file["']?\s*:\s*["']([^\\"']+)["']/,
        /["']?url["']?\s*:\s*["']([^\\"']+)["']/
      ];

      for (const pat of patterns) {
        const match = scripts.match(pat);
        if (match) {
          let videoUrl = match[1].replace(/\\\//g, '/');

          // Follow redirection to get direct link
          try {
            const headRes = await api.request.get(videoUrl, {
              headers: { ...headers, 'Referer': url },
              maxRedirects: 5,
              validateStatus: (status: number) => status >= 200 && status < 400,
              timeout: 5000
            });
            const requestObj = headRes.request as any;
            videoUrl = requestObj?.res?.responseUrl || videoUrl;
          } catch (e: any) {
            try {
              const getRes = await api.request.get(videoUrl, {
                headers: { ...headers, 'Referer': url },
                responseType: 'stream',
                maxRedirects: 5,
                validateStatus: (status: number) => status >= 200 && status < 400,
                timeout: 5000
              });
              const requestObj = getRes.request as any;
              videoUrl = requestObj?.res?.responseUrl || videoUrl;
              getRes.data.destroy();
            } catch (e2: any) {
              console.warn(`[PlayCNVS] Failed to follow redirect for ${videoUrl}:`, e2.message);
            }
          }

          return [{
            name: 'VisionCine Direct',
            url: videoUrl,
            quality: 'Auto',
            referer: url,
            type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4'
          }];
        }
      }
    } catch (e: any) {
      console.error('[PlayCNVS] Extraction error:', e.message);
    }

    return null;
  }
}));
