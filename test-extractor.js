const extractorsManager = require('./src/extractorsManager');

async function test() {
  const url = process.argv[2];
  const targetExtractorName = process.argv[3]; // Opcional

  if (!url) {
    console.error('Uso: node test-extractor.js <URL> [NomeDoExtrator]');
    console.error('Exemplo: node test-extractor.js https://... MixDrop');
    process.exit(1);
  }

  console.log(`\n[Test] Iniciando extração para: ${url}`);
  if (targetExtractorName) {
    console.log(`[Test] Filtrando apenas extrator: ${targetExtractorName}`);
  }
  console.log('--------------------------------------------------');

  try {
    let results = null;

    if (targetExtractorName) {
      // Busca o extrator pelo nome
      const extractor = extractorsManager.extractors.find(e =>
        e.name.toLowerCase() === targetExtractorName.toLowerCase()
      );

      if (!extractor) {
        console.error(`\n❌ Erro: Extrator "${targetExtractorName}" não encontrado.`);
        console.log('Extratores disponíveis:', extractorsManager.extractors.map(e => e.name).join(', '));
        process.exit(1);
      }

      console.log(`Usando extrator ${extractor.name} (Forçado) para: ${url}`);
      results = await extractor.extract(url);
    } else {
      // Comportamento padrão: tenta todos
      results = await extractorsManager.extract(url);
    }

    if (results && results.length > 0) {
      console.log('\n✅ Sucesso! Links encontrados:');
      results.forEach((res, i) => {
        console.log(`\nLink #${i + 1}:`);
        console.log(`  Provedor: ${res.name}`);
        console.log(`  Qualidade: ${res.quality}`);
        console.log(`  URL Direta: ${res.url}`);
        if (res.referer) {
          console.log(`  Referer: ${res.referer}`);
        }
      });
    } else {
      console.log('\n❌ Falha: Nenhum link direto extraído.');
      console.log('Verifique se o domínio é suportado ou se a lógica do extrator precisa de ajustes.');
    }
  } catch (err) {
    console.error('\n💥 Erro crítico durante o teste:');
    console.error(err);
  }

  console.log('\n--------------------------------------------------');
}

test();
