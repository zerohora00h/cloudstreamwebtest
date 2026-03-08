const fs = require('fs');
const path = require('path');

const plugins = {};

function loadPlugins(pluginsDir) {
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
    console.log(`Diretório de plugins criado em: ${pluginsDir}`);
    return;
  }

  const files = fs.readdirSync(pluginsDir);

  files.forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const pluginPath = path.join(pluginsDir, file);

        // Invalidate require cache to allow reloading during dev
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);

        if (plugin.id && plugin.name) {
          plugins[plugin.id] = plugin;
          console.log(`[Plugin] Carregado: ${plugin.name} (${plugin.id})`);
        } else {
          console.warn(`[Plugin] O arquivo ${file} não exporta 'id' ou 'name' válidos.`);
        }
      } catch (err) {
        console.error(`[Plugin] Erro ao carregar o plugin ${file}:`, err);
      }
    }
  });
}

function getPluginsList() {
  return Object.values(plugins).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    version: p.version || '1.0.0'
  }));
}

function getPlugin(id) {
  return plugins[id];
}

module.exports = {
  loadPlugins,
  getPluginsList,
  getPlugin
};
