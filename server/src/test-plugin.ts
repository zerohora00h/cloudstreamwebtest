import { PluginSandboxApi } from './core/plugin-api/api';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';

// Simulação da API que é injetada nos plugins
const sandboxApi: PluginSandboxApi = {
  request: {
    get: (url, config) => axios.get(url, { ...config, timeout: 10000 }),
    post: (url, data, config) => axios.post(url, data, { ...config, timeout: 10000 }),
  },
  html: {
    parse: (html) => cheerio.load(html),
  },
};

async function runTest() {
  const pluginName = process.argv[2];
  const method = process.argv[3]; // home, search, load, links
  const param = process.argv[4];

  if (!pluginName || !method) {
    console.log('\n❌ Uso: npx tsx src/test-plugin.ts <NOME_PLUGIN> <METODO> [PARAMETRO]');
    console.log('\nMétodos:');
    console.log('  home           - Testa o getHome()');
    console.log('  search <query> - Testa o search(query)');
    console.log('  load <url>    - Testa o load(url)');
    console.log('  links <data>   - Testa o loadLinks(data)');
    console.log('\nExemplo:');
    console.log('  npx tsx src/test-plugin.ts visioncine load https://cnvsweb.stream/watch/os-sete-relgios-de-agatha-christie\n');
    process.exit(1);
  }

  try {
    let pluginPath = path.resolve(__dirname, 'plugins', pluginName, 'index.ts');
    
    // No Windows, o import dinâmico precisa de file:// para caminhos absolutos
    const pluginUrl = `file://${pluginPath.replace(/\\/g, '/')}`;
    console.log(`\n🔌 Carregando plugin de: ${pluginUrl}`);
    
    // Importa o factory e executa passando a nossa sandboxApi
    const pluginModule = await import(pluginUrl);
    const pluginFactory = pluginModule.default;
    
    // O plugin é criado chamando o createPlugin que recebe o factory
    // Mas aqui como estamos importando direto, o export default é o resultado de createPlugin(factory)
    // que já é o objeto com os métodos.
    const plugin = pluginFactory;

    console.log(`🚀 Executando método: ${method}`);
    console.log('--------------------------------------------------');

    let result;
    switch (method.toLowerCase()) {
      case 'home':
        result = await plugin.getHome();
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'search':
        if (!param) throw new Error('Query de busca necessária.');
        result = await plugin.search(param);
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'load':
        if (!param) throw new Error('URL necessária.');
        result = await plugin.load(param);
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'links':
        if (!param) throw new Error('Dados (URL do episódio) necessários.');
        result = await plugin.loadLinks(param);
        console.log(JSON.stringify(result, null, 2));
        break;
      default:
        console.log(`❌ Método desconhecido: ${method}`);
    }

    console.log('--------------------------------------------------');
    console.log('✅ Teste finalizado com sucesso.');
  } catch (error: any) {
    console.error(`\n❌ Erro durante o teste:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    process.exit(1);
  }
}

runTest();
