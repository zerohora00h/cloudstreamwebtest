const axios = require('axios');
const JsUnpacker = require('../utils/jsUnpacker');

module.exports = {
  name: 'MixDrop',
  // Domínios atualizados com base nas variações do código Kotlin original
  domains: [
    'mixdrop.co', 'mixdrop.to', 'mixdrop.sx', 'mixdrop.bz', 'mixdrop.ch',
    'mixdrop.ag', 'mixdrop.gl', 'mixdrop.ps', 'm1xdrop.bz', 'mdy48tn97.com',
    'mxdrop.to', 'mixdrop.si'
  ],

  async extract(url) {
    try {
      const embedUrl = url.replace('/f/', '/e/');
      const res = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = res.data;
      let unpackedText = html;

      // 1. Isolar APENAS o script empacotado para não sobrecarregar o regex
      const packedScriptMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\).*?\)\)/);

      if (packedScriptMatch) {
        const unpacker = new JsUnpacker(packedScriptMatch[0]);
        const result = unpacker.unpack();
        // Se desempacotou com sucesso (result é diferente do código compactado)
        if (result && result !== packedScriptMatch[0]) {
          unpackedText = result;
        }
      }

      // 2. Regex alinhado com o Kotlin (adicionando o ; opcional por segurança)
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
          referer: url
        }];
      }
    } catch (e) {
      console.error('MixDrop extraction error:', e.message);
    }
    return null;
  }
};