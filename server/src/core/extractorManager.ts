import fs from 'fs';
import path from 'path';
import type { StreamLink } from '../../../shared/types';

interface Extractor {
  name: string;
  domains: string[];
  extract(url: string): Promise<StreamLink[] | null>;
}

export class ExtractorManager {
  private static extractors: Extractor[] = [];
  private static loaded = false;

  static load(): void {
    if (this.loaded) return;

    const dir = path.join(__dirname, '..', 'extractors');
    this.loadFromDir(dir);
    this.loaded = true;
  }

  static loadFromDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      if (dir.endsWith('extractors') && !dir.includes('plugins')) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Extractor] Directory created: ${dir}`);
      }
      return;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    for (const file of files) {
      try {
        const fullPath = path.resolve(path.join(dir, file));
        // Use require on the absolute path
        delete require.cache[require.resolve(fullPath)];
        const mod = require(fullPath);
        const extractor = mod.default || mod;

        if (!extractor.name || !extractor.domains) {
          console.warn(`[Extractor] Skipped ${file}: missing 'name' or 'domains'`);
          continue;
        }

        // Avoid duplicate extractors by name
        if (!this.extractors.some(e => e.name === extractor.name)) {
          this.extractors.push(extractor);
          console.log(`[Extractor] Loaded: ${extractor.name}`);
        }
      } catch (e: any) {
        console.error(`[Extractor] Error loading ${file} from ${dir}:`, e.message);
      }
    }
  }

  static getExtractors(): Extractor[] {
    this.load();
    return this.extractors;
  }

  static async extract(url: string, forceExtractorName?: string): Promise<StreamLink[] | null> {
    this.load();

    if (forceExtractorName) {
      const extractor = this.extractors.find(e => e.name.toLowerCase() === forceExtractorName.toLowerCase());
      if (extractor) {
        console.log(`[Extractor] Forcing extractor: ${extractor.name}`);
        return await extractor.extract(url);
      }
      console.warn(`[Extractor] Forced extractor not found: ${forceExtractorName}`);
    }

    for (const extractor of this.extractors) {
      if (extractor.domains.some(d => url.includes(d))) {
        try {
          const result = await extractor.extract(url);
          if (result && result.length > 0) return result;
        } catch (e: any) {
          console.error(`[Extractor] ${extractor.name} error:`, e.message);
        }
      }
    }
    return null;
  }
}
