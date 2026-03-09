const axios = require('axios');

module.exports = {
  name: 'StreamTape',
  domains: ['streamtape.com', 'streamtape.net', 'streamtape.xyz', 'shavetape.cash', 'watchadsontape.com'],

  async extract(url) {
    try {
      // Converte para a URL de embed, onde o script do player fica exposto
      const embedUrl = url.replace('/v/', '/e/');
      const res = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const html = res.data;

      // 1. Separa o HTML por linhas (exatamente como o ?.html()?.lines() do Kotlin)
      const lines = html.split('\n');

      // 2. Encontra a linha específica que manipula o botlink/robotlink
      const targetLine = lines.find(line => line.includes("botlink').innerHTML"));

      if (targetLine) {
        // 3. Pega tudo que está depois do ".innerHTML ="
        const expressionMatch = targetLine.match(/\.innerHTML\s*=\s*(.*);?/);

        if (expressionMatch && expressionMatch[1]) {
          // Limpa o ponto e vírgula do final, se houver
          let expression = expressionMatch[1].trim();
          if (expression.endsWith(';')) {
            expression = expression.slice(0, -1);
          }

          // 4. Executa a expressão JS para resolver a concatenação de strings automaticamente
          // Isso replica perfeitamente o papel do Rhino (Context.enter().evaluateString(...)) do Kotlin
          const resolvedPath = new Function(`return ${expression}`)();

          // 5. Adiciona o prefixo https: e o sufixo &stream=1 que faltava
          const videoUrl = `https:${resolvedPath}&stream=1`;

          return [{
            name: 'StreamTape Direct',
            url: videoUrl,
            quality: 'Auto',
            type: 'mp4',
            referer: url
          }];
        }
      }
    } catch (e) {
      console.error('StreamTape extraction error:', e.message);
    }
    return null;
  }
};