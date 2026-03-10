import type { StreamLink } from '@shared/types';
import crypto from 'crypto';
import { createExtractor } from '@plugin-api';

export default createExtractor((api) => ({
  name: 'Byse Direct',
  domains: [
    'byse.sx',
    'bysezejataos.com',
    'bysebuho.com',
    'bysevepoin.com',
    'byseqekaho.com',
    'myvidplay.com'
  ],

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const code = parsedUrl.pathname.split('/').filter(Boolean).pop();

      if (!code) return [];

      // 1. Get Details
      const detailsUrl = `${baseUrl}/api/videos/${code}/embed/details`;
      const detailsRes = await api.request.get(detailsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) rv:130.0' }
      });
      const details = detailsRes.data;

      if (!details || !details.embed_frame_url) return [];

      // 2. Get Playback
      const embedFrameUrl = details.embed_frame_url;
      const embedParsed = new URL(embedFrameUrl);
      const embedBase = `${embedParsed.protocol}//${embedParsed.host}`;
      const embedCode = embedParsed.pathname.split('/').filter(Boolean).pop();

      const playbackUrl = `${embedBase}/api/videos/${embedCode}/embed/playback`;
      const playbackRes = await api.request.get(playbackUrl, {
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.5',
          'referer': embedFrameUrl,
          'x-embed-parent': url,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) rv:130.0'
        }
      });

      const playbackData = playbackRes.data?.playback;
      if (!playbackData) return [];

      // 3. Decrypt Playback
      const streamUrl = decryptPlayback(playbackData);

      if (streamUrl) {
        return [{
          name: 'Byse Direct',
          url: streamUrl,
          quality: 'Auto',
          type: 'hls',
          referer: baseUrl
        }];
      }

    } catch (e: any) {
      console.error(`[Extractor] Byse error:`, e.message);
    }
    return [];
  }
}));

function decryptPlayback(playback: any): string | null {
  try {
    const keyParts = playback.key_parts;
    if (!keyParts || keyParts.length < 2) {
      console.error('[Byse] Missing key_parts');
      return null;
    }

    // Build AES Key (256-bit)
    const p1 = b64UrlDecode(keyParts[0]);
    const p2 = b64UrlDecode(keyParts[1]);
    const key = Buffer.concat([p1, p2]);

    const iv = b64UrlDecode(playback.iv);
    const payload = b64UrlDecode(playback.payload);

    // In AES-GCM, the auth tag is appended to the ciphertext
    const tag = payload.subarray(-16);
    const ciphertext = payload.subarray(0, -16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key as any, iv as any);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext as any, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    // Remove BOM if present
    if (decrypted.startsWith('\uFEFF')) {
      decrypted = decrypted.substring(1);
    }

    const decryptedJson = JSON.parse(decrypted);
    return decryptedJson.sources?.[0]?.url || null;

  } catch (e: any) {
    console.error(`[Extractor] Byse decryption failed:`, e.message);
    return null;
  }
}

function b64UrlDecode(s: string): Buffer {
  const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (fixed.length % 4)) % 4;
  return Buffer.from(fixed + '='.repeat(pad), 'base64');
}
