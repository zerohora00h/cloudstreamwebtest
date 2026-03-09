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
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const extractor = require(path.join(dir, file));
        this.extractors.push(extractor);
        console.log(`[Extractor] Loaded: ${extractor.name}`);
      } catch (e: any) {
        console.error(`[Extractor] Error loading ${file}:`, e.message);
      }
    }
    this.loaded = true;
  }

  static async extract(url: string): Promise<StreamLink[] | null> {
    this.load();

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
