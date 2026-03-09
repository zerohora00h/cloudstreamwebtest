const axios = require('axios');
const cheerio = require('cheerio');
const JsUnpacker = require('../utils/jsUnpacker');

module.exports = {
  name: 'FileMoon',
  domains: ['filemoon.sx', 'filemoon.to', 'filemoon.in', 'filemoon.net'],

  async extract(url) {
    try {
      // 1. Replica os Headers originais do Kotlin (crucial para não ser bloqueado)
      const defaultHeaders = {
        'Referer': url,
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0'
      };

      // 2. Requisição Inicial
      const res = await axios.get(url, { headers: defaultHeaders });
      let htmlToProcess = res.data;

      // 3. Procura pelo iframe usando Cheerio (equivalente ao selectFirst do Kotlin)
      const $ = cheerio.load(htmlToProcess);
      const iframeSrc = $('iframe').attr('src');

      // 4. Se o iframe existir, fazemos a requisição para ele!
      if (iframeSrc) {
        const iframeHeaders = { ...defaultHeaders, 'Accept-Language': 'en-US,en;q=0.5' };
        const iframeRes = await axios.get(iframeSrc, { headers: iframeHeaders });
        htmlToProcess = iframeRes.data;
      }

      // 5. Extrai APENAS a tag <script> que está empacotada (packed)
      const $$ = cheerio.load(htmlToProcess);
      let packedScript = '';

      $$('script').each((_, el) => {
        const scriptContent = $$(el).html();
        if (scriptContent && scriptContent.includes('function(p,a,c,k,e,d)')) {
          packedScript = scriptContent;
        }
      });

      if (!packedScript) {
        console.warn('Script compactado não encontrado na página.');
        return null;
      }

      // 6. Desempacota apenas o conteúdo do script
      const unpacker = new JsUnpacker(packedScript);
      const unpacked = unpacker.unpack();

      if (!unpacked) return null;

      // 7. Regex exato usado no Kotlin
      const fileRegex = /sources\s*:\s*\[\s*\{\s*file\s*:\s*["'](.*?)["']/;
      const match = unpacked.match(fileRegex);

      if (match && match[1]) {
        return [{
          name: 'FileMoon Direct',
          url: match[1],
          quality: 'Auto',
          referer: url
        }];
      }

    } catch (e) {
      console.error('FileMoon extraction error:', e.message);
    }

    return null;
  }
};
