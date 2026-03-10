/**
 * JS Unpacker for Dean Edwards Packer (eval(function(p,a,c,k,e,d)...))
 * Versão otimizada e espelhada no port original do Cloudstream (Kotlin).
 */
export default class JsUnpacker {
  private packed: string;

  constructor(packed: string) {
    this.packed = packed;
  }

  unpack(): string | null {
    if (!this.packed) return null;

    const packerPattern = /eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\}\s*\(\s*'(.*)'\s*,\s*(.*?)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/;

    const match = this.packed.match(packerPattern);

    if (!match) {
      // Se não deu match, provavelmente já está desempacotado
      return this.packed;
    }

    let [, p, a, c, k] = match;

    // Unescape de aspas simples no payload
    p = p.replace(/\\'/g, "'");

    const dict = k.split('|');
    const base = parseInt(a, 10) || 36;
    const count = parseInt(c, 10) || 0;

    if (dict.length !== count) {
      throw new Error("Unknown p.a.c.k.e.r. encoding");
    }

    // Alfabetos usados para bases maiores que 36
    const ALPHABET_62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const ALPHABET_95 = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

    const unbase = (str: string, radix: number) => {
      if (radix <= 36) return parseInt(str, radix);
      const alphabet = radix <= 62 ? ALPHABET_62 : ALPHABET_95;
      let ret = 0;
      for (let i = 0; i < str.length; i++) {
        ret = ret * radix + alphabet.indexOf(str[i]);
      }
      return ret;
    };

    const pRepl = p.replace(/\b[a-zA-Z0-9_]+\b/g, (word) => {
      const x = unbase(word, base);

      if (x >= 0 && x < count && dict[x]) {
        return dict[x];
      }

      return word;
    });

    return pRepl;
  }

  static detect(text: string): boolean {
    return /eval\(function\(p,a,c,k,e,[rd]\)/.test(text);
  }
}
