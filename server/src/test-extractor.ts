import { ExtractorManager } from './core/extractorManager';

async function testExtractor() {
  const url = process.argv[2];
  const forceExtractor = process.argv[3];

  if (!url) {
    console.log('\n❌ Uso: npx tsx src/test-extractor.ts <URL> [NOME_EXTRATOR]');
    console.log('\nExemplos:');
    console.log('  npx tsx src/test-extractor.ts https://blogger.com/video.g?token=... ');
    console.log('  npx tsx src/test-extractor.ts https://site.com/video Blogger\n');

    console.log('Extratores disponíveis:');
    ExtractorManager.getExtractors().forEach(e => {
      console.log(` - ${e.name} (${e.domains.join(', ')})`);
    });
    process.exit(1);
  }

  console.log(`\n🔍 Testando URL: ${url}`);
  if (forceExtractor) {
    console.log(`🎯 Forçando Extrator: ${forceExtractor}`);
  }
  console.log('--------------------------------------------------');

  try {
    const results = await ExtractorManager.extract(url, forceExtractor);

    if (results && results.length > 0) {
      console.log(`✅ Sucesso! ${results.length} link(s) encontrado(s):`);
      results.forEach((link, i) => {
        console.log(`\n[Link ${i + 1}]`);
        console.log(`  Nome: ${link.name}`);
        console.log(`  URL:  ${link.url.substring(0, 100)}${link.url.length > 100 ? '...' : ''}`);
        console.log(`  Qualidade: ${link.quality}`);
        if (link.referer) console.log(`  Referer: ${link.referer}`);
        if (link.headers) console.log(`  Headers: ${JSON.stringify(link.headers)}`);
      });
    } else {
      console.log('⚠️ Nenhum link extraído.');
      console.log('Dica: Verifique se o domínio é suportado ou use o nome do extrator como segundo argumento.');
    }
  } catch (error: any) {
    console.error('❌ Erro durante a extração:', error.message);
  }

  console.log('--------------------------------------------------\n');
}

testExtractor();
