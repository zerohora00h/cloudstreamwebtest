const fs = require('fs');
const path = require('path');

class ExtractorsManager {
  constructor() {
    this.extractors = [];
    this.loadExtractors();
  }

  loadExtractors() {
    const extractorsPath = path.join(__dirname, 'extractors');
    if (!fs.existsSync(extractorsPath)) {
      fs.mkdirSync(extractorsPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(extractorsPath);
    for (const file of files) {
      if (file.endsWith('.js')) {
        try {
          const extractor = require(path.join(extractorsPath, file));
          this.extractors.push(extractor);
          console.log(`[Extractor] Carregado: ${extractor.name}`);
        } catch (e) {
          console.error(`[Extractor] Erro ao carregar ${file}:`, e.message);
        }
      }
    }
  }

  async extract(url) {
    if (!url) return null;

    for (const extractor of this.extractors) {
      // Check if extractor can handle this URL
      if (extractor.domains.some(d => url.includes(d))) {
        try {
          console.log(`Usando extrator ${extractor.name} para: ${url}`);
          const result = await extractor.extract(url);
          if (result && result.length > 0) {
            return result;
          }
        } catch (e) {
          console.error(`Erro no extrator ${extractor.name}:`, e.message);
        }
      }
    }

    // Fallback: return as-is (might be a direct link already or handled by iframe)
    return null;
  }
}

module.exports = new ExtractorsManager();
