/**
 * JS Unpacker for Dean Edwards Packer (eval(function(p,a,c,k,e,d)...))
 * Versão otimizada e espelhada no port original do Cloudstream (Kotlin).
 */
class JsUnpacker {
  constructor(packed) {
    this.packed = packed;
  }

  unpack() {
    if (!this.packed) return null;

    // Ajuste no Regex:
    // 1. [rd] em vez de d puro (pega variações do packer).
    // 2. '(.*)' agora é guloso (greedy) para não quebrar com vírgulas dentro do código.
    // 3. (.*?) para a base (a), pois às vezes a base é uma expressão e não só dígitos.
    const packerPattern = /eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\}\s*\(\s*'(.*)'\s*,\s*(.*?)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/;

    const match = this.packed.match(packerPattern);

    if (!match) {
      // Se não deu match, provavelmente já está desempacotado
      return this.packed;
    }

    let [_, p, a, c, k] = match;

    // Unescape de aspas simples no payload (igual ao replace("\\'", "'") do Kotlin)
    p = p.replace(/\\'/g, "'");

    const dict = k.split('|');
    const base = parseInt(a, 10) || 36;
    const count = parseInt(c, 10) || 0;

    if (dict.length !== count) {
      throw new Error("Unknown p.a.c.k.e.r. encoding");
    }

    // Alfabetos usados para bases maiores que 36 (idêntico ao Unbase do Kotlin)
    const ALPHABET_62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const ALPHABET_95 = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

    // Função que converte as palavras embaralhadas de volta para um índice inteiro (Unbase)
    const unbase = (str, radix) => {
      if (radix <= 36) return parseInt(str, radix);
      const alphabet = radix <= 62 ? ALPHABET_62 : ALPHABET_95;
      let ret = 0;
      for (let i = 0; i < str.length; i++) {
        ret = ret * radix + alphabet.indexOf(str[i]);
      }
      return ret;
    };

    // Nova lógica de substituição: iteramos sobre as "palavras" no payload em vez
    // de tentar substituir do fim pro começo. 
    // É mais rápido e idêntico a como o packer executa nativamente no browser.
    const pRepl = p.replace(/\b[a-zA-Z0-9_]+\b/g, (word) => {
      const x = unbase(word, base);

      // Se o índice for válido e a string no dicionário não for vazia, substitui
      if (x >= 0 && x < count && dict[x]) {
        return dict[x];
      }

      // Caso contrário, deixa como está
      return word;
    });

    return pRepl;
  }

  static detect(text) {
    return /eval\(function\(p,a,c,k,e,[rd]\)/.test(text);
  }
}

module.exports = JsUnpacker;