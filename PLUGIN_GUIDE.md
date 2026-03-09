# 📦 Guia de Criação de Plugins — CloudStream Web

Este guia explica como criar plugins para o CloudStream Web usando a API tipada em TypeScript.

---

## Estrutura de um Plugin

Cada plugin é uma pasta dentro de `server/src/plugins/` com a seguinte estrutura:

```
server/src/plugins/
└── meu-plugin/
    ├── plugin.json        ← Manifesto (obrigatório)
    ├── index.ts           ← Lógica principal (obrigatório)
    └── extractors/        ← Extratores locais (opcional)
        └── meu-extrator.ts
```

---

## 1. Manifesto (`plugin.json`)

```json
{
  "id": "meu-plugin",
  "name": "Meu Plugin",
  "description": "Descrição curta do plugin",
  "version": "1.0.0",
  "main": "index.ts"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `string` | ✅ | Identificador único (slug, sem espaços) |
| `name` | `string` | ✅ | Nome de exibição |
| `description` | `string` | ✅ | Descrição curta |
| `version` | `string` | ✅ | Versão semântica |
| `main` | `string` | ✅ | Arquivo de entrada (normalmente `index.ts`) |

---

## 2. Plugin (`index.ts`)

Todo plugin usa a função `createPlugin` que injeta automaticamente a API segura:

```typescript
import { createPlugin } from '@plugin-api';
import type { HomeSection, MediaDetails, MediaItem, StreamLink } from '@shared/types';

export default createPlugin((api) => ({
  async getHome(): Promise<HomeSection[]> {
    // Buscar conteúdo da página inicial
  },

  async search(query: string): Promise<MediaItem[]> {
    // Buscar resultados de pesquisa
  },

  async load(url: string): Promise<MediaDetails> {
    // Carregar detalhes de um filme/série
  },

  async loadLinks(data: string): Promise<StreamLink[]> {
    // Extrair links de streaming
  }
}));
```

---

## 3. API Disponível (`api`)

O objeto `api` é injetado pelo servidor e contém:

### `api.request` — Requisições HTTP

```typescript
// GET
const res = await api.request.get(url, {
  headers: { 'User-Agent': '...' },
  timeout: 5000
});
const html = res.data; // string com o HTML

// POST
const res = await api.request.post(url, { campo: 'valor' }, {
  headers: { 'Content-Type': 'application/json' }
});
```

### `api.html` — Parser HTML (Cheerio)

```typescript
const $ = api.html.parse(res.data);

// Usar seletores CSS como jQuery
const titulo = $('h1.titulo').text().trim();
const link = $('a.link').attr('href');
$('div.item').each((i, el) => {
  const nome = $(el).find('span').text();
});
```

> ⚠️ **Importante:** Nunca importe `axios` ou `cheerio` diretamente. Use sempre `api.request` e `api.html`.

---

## 4. Tipos de Retorno

### `MediaItem` — Item de mídia (home e busca)
```typescript
{
  name: string;       // "Vingadores"
  url: string;        // URL da página de detalhes
  type: 'Movie' | 'TvSeries' | 'Anime';
  posterUrl: string;   // URL da imagem do poster
  year?: number;       // 2024 (opcional)
  score?: number;      // 8.5 (opcional)
}
```

### `HomeSection` — Seção da home
```typescript
{
  name: string;        // "Filmes - Ação"
  list: MediaItem[];   // Lista de itens
}
```

### `MediaDetails` — Detalhes de um conteúdo
```typescript
{
  name: string;
  url: string;
  type: 'Movie' | 'TvSeries' | 'Anime';
  posterUrl: string;
  plot?: string;             // Sinopse
  year?: number;
  tags?: string[];           // ["Ação", "Aventura"]
  score?: number;
  duration?: number;         // Em minutos
  dataUrl?: string;          // Usado no loadLinks (para filmes)
  episodes?: Episode[];      // Usado para séries
  recommendations?: MediaItem[];
}
```

### `Episode` — Episódio de série
```typescript
{
  name: string;    // "Episódio 1"
  season: number;  // 1
  episode: number; // 1
  data: string;    // Dados passados ao loadLinks
}
```

### `StreamLink` — Link de streaming
```typescript
{
  name: string;              // "Servidor 1"
  url: string;               // URL do vídeo ou embed
  quality: string;           // "720p", "1080p", "Auto"
  type?: 'hls' | 'mp4';     // Tipo do stream (opcional)
  referer?: string;          // Referer para o player (opcional)
}
```

---

## 5. Extratores (Opcional)

Se o site do seu plugin usa um player próprio ou pouco conhecido, você pode criar um extrator local. Crie na subpasta `extractors/`:

```typescript
// extractors/meu-player.ts
import { createExtractor } from '@plugin-api';
import type { StreamLink } from '@shared/types';

export default createExtractor((api) => ({
  name: 'MeuPlayer',
  domains: ['meuplayer.com', 'cdn.meuplayer.com'],

  async extract(url: string): Promise<StreamLink[] | null> {
    const res = await api.request.get(url);
    const $ = api.html.parse(res.data);

    // Extrair URL do vídeo do HTML/scripts
    const videoUrl = $('video source').attr('src');

    if (!videoUrl) return null;

    return [{
      name: 'MeuPlayer Direct',
      url: videoUrl,
      quality: 'Auto',
      referer: url,
      type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4'
    }];
  }
}));
```

O extrator é carregado automaticamente e associado **somente ao seu plugin**. Quando o `loadLinks` retornar um URL que contém um dos `domains` do extrator, ele será chamado automaticamente.

---

## 6. Fluxo Completo

```
   Usuário abre a Home
          │
          ▼
    getHome() → HomeSection[]
          │
   Usuário pesquisa "Batman"
          │
          ▼
    search("Batman") → MediaItem[]
          │
   Usuário clica em um item
          │
          ▼
    load(url) → MediaDetails
          │
   Usuário clica em "Assistir"
          │
          ▼
    loadLinks(data) → StreamLink[]
          │
   Servidor tenta extratores
          │
          ▼
    1º Extratores LOCAIS do plugin
    2º Extratores globais (fallback)
          │
          ▼
       🎬 Player
```

---

## 7. Checklist de Segurança

- ✅ Use **somente** `api.request` e `api.html`
- ❌ Não importe `axios`, `cheerio`, `fs`, `child_process`, etc.
- ❌ Não acesse `process.env` ou variáveis globais do Node
- ✅ Mantenha todo o código dentro da pasta do plugin
- ✅ Retorne sempre os tipos corretos (TypeScript vai ajudar)
