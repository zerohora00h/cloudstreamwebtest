import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';
import crypto from 'crypto';

export default createExtractor((api) => ({
  name: 'VidStack',
  domains: ['vidstack.io', 'server1.uns.bio', 'uns.bio', 'vidcdn.pro', 'embedplay.upns.ink', 'embedplay.upns.one', 'embedplay.upns.pro'], // Domains found in the Kotlin class

  async extract(url: string): Promise<StreamLink[] | null> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0'
      };

      // Obtém o "hash" (id) extraindo o conteúdo após '#' e depois após '/'
      const hashPart = url.split('#').pop() || '';
      const hash = hashPart.split('/').pop() || '';

      // Monta a base URL
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      const apiUrl = `${baseUrl}/api/v1/video?id=${hash}`;

      // Faz a requisição
      const res = await api.request.get(apiUrl, { headers });
      const encoded = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).trim();

      const key = 'kiemtienmua911ca';
      const ivList = ['1234567890oiuytr', '0123456789abcdef'];

      let decryptedText: string | null = null;

      // Tenta decriptar o texto hex com as chaves e os diferentes vetores de inicialização
      for (const iv of ivList) {
        try {
          const decipher = crypto.createDecipheriv(
            'aes-128-cbc',
            Buffer.from(key, 'utf8'),
            Buffer.from(iv, 'utf8')
          );

          let decrypted = decipher.update(encoded, 'hex', 'utf8');
          decrypted += decipher.final('utf8');

          decryptedText = decrypted;
          break; // Sucesso, aborta o loop
        } catch (e) {
          // Falhou, continua para a próxima IV
        }
      }

      if (!decryptedText) {
        throw new Error('Falha ao decriptar a resposta com todas as IVs');
      }

      // Extrai o link do M3U8
      const m3u8Match = decryptedText.match(/"source"\s*:\s*"(.*?)"/);
      const m3u8 = m3u8Match ? m3u8Match[1].replace(/\\\//g, '/') : '';

      if (!m3u8) {
        return null;
      }

      // Opcional: A extração de legendas estava presente no original.
      // Atualmente apenas retornamos o streaming de vídeo no StreamLink.

      const links: StreamLink[] = [];
      links.push({
        name: 'VidStack',
        url: m3u8,
        quality: 'Auto',
        type: 'hls',
        referer: url
      });

      return links;

    } catch (error: any) {
      console.error('VidStack Extractor Error:', error.message);
      return null;
    }
  }
}));
