const axios = require('axios');
const crypto = require('crypto');
const { URL } = require('url');

/**
 * Extrator experimental para sites baseados em Byse.sx
 * Utiliza descriptografia AES-128-GCM para obter o link final.
 */
module.exports = {
  name: 'Byse',
  domains: [
    'byse.sx',
    'bysezejataos.com',
    'bysebuho.com',
    'bysevepoin.com',
    'byseqekaho.com'
  ],

  async extract(url) {
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const code = parsedUrl.pathname.split('/').filter(Boolean).pop();

      if (!code) return null;

      // 1. Get Details
      const detailsUrl = `${baseUrl}/api/videos/${code}/embed/details`;
      const detailsRes = await axios.get(detailsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) rv:130.0' }
      });
      const details = detailsRes.data;

      if (!details || !details.embed_frame_url) return null;

      // 2. Get Playback
      const embedFrameUrl = details.embed_frame_url;
      const embedParsed = new URL(embedFrameUrl);
      const embedBase = `${embedParsed.protocol}//${embedParsed.host}`;
      const embedCode = embedParsed.pathname.split('/').filter(Boolean).pop();

      const playbackUrl = `${embedBase}/api/videos/${embedCode}/embed/playback`;
      const playbackRes = await axios.get(playbackUrl, {
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.5',
          'referer': embedFrameUrl,
          'x-embed-parent': url,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) rv:130.0'
        }
      });

      const playbackData = playbackRes.data?.playback;
      if (!playbackData) return null;

      // 3. Decrypt Playback
      const streamUrl = this.decryptPlayback(playbackData);

      if (streamUrl) {
        return [{
          name: this.name,
          url: streamUrl,
          quality: 'Auto',
          referer: baseUrl
        }];
      }

    } catch (e) {
      console.error(`[Extractor] ${this.name} error:`, e.message);
    }
    return null;
  },

  decryptPlayback(playback) {
    try {
      const keyParts = playback.key_parts;
      if (!keyParts || keyParts.length < 2) {
        console.error('[Byse] Missing key_parts');
        return null;
      }

      // Build AES Key (256-bit)
      const p1 = this.b64UrlDecode(keyParts[0]);
      const p2 = this.b64UrlDecode(keyParts[1]);
      const key = Buffer.concat([p1, p2]);

      const iv = this.b64UrlDecode(playback.iv);
      const payload = this.b64UrlDecode(playback.payload);

      // In AES-GCM, the auth tag is appended to the ciphertext in Java/Kotlin implementations
      const tag = payload.slice(-16);
      const ciphertext = payload.slice(0, -16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      // Remove BOM if present
      if (decrypted.startsWith('\uFEFF')) {
        decrypted = decrypted.substring(1);
      }

      const decryptedJson = JSON.parse(decrypted);
      return decryptedJson.sources?.[0]?.url || null;

    } catch (e) {
      console.error(`[Extractor] ${this.name} decryption failed:`, e.message);
      return null;
    }
  },

  b64UrlDecode(s) {
    const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (fixed.length % 4)) % 4;
    return Buffer.from(fixed + '='.repeat(pad), 'base64');
  }
};
