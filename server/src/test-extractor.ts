import { ExtractorManager } from './core/extractorManager';

async function testExtractor() {
  const url = process.argv[2];

  if (!url) {
    console.log('❌ Uso: npx tsx src/test-extractor.ts <URL>');
    process.exit(1);
  }

  console.log(`\n🔍 Testando URL: ${url}`);
  console.log('--------------------------------------------------');

  try {
    const results = await ExtractorManager.extract(url);

    if (results && results.length > 0) {
      console.log('✅ Sucesso! Links encontrados:');
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log('⚠️ Nenhum link extraído. Verifique se o domínio é suportado ou se o site mudou a proteção.');
    }
  } catch (error: any) {
    console.error('❌ Erro durante a extração:', error.message);
  }

  console.log('--------------------------------------------------\n');
}

testExtractor();
