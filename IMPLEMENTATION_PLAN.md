# CloudStreamWeb — Projeto Real

Reconstrução do protótipo como um projeto real usando **React + Vite + Tailwind + HeroUI** (frontend) e **Express** (backend). O site é uma versão web do app CloudStream: um shell vazio que é populado por plugins. Os plugins devem ser sandboxados e tipados para segurança.

---

## Decisões de Arquitetura

### Monorepo com 2 pacotes
```
cloudstreamweb/
├── client/          ← Vite + React + Tailwind + HeroUI
├── server/          ← Express + Plugin System
└── shared/          ← Tipos compartilhados (contratos de plugin)
```

> **IMPORTANTE — Segurança dos Plugins**: Ao invés de simplesmente `require()` nos plugins (que dá acesso a `fs`, `child_process`, etc.), vamos usar `vm.runInNewContext` do Node.js para executar os plugins em um contexto isolado. O plugin só terá acesso às utilidades que **nós** fornecemos (como `http.get`, `html.parse`). Isso é o equivalente JS do que o CloudStream faz no Kotlin com suas APIs controladas.

### Contrato de Plugin (Tipos)

Os plugins devem exportar um objeto que obedece a este contrato:

```typescript
// shared/types.ts
interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  lang?: string;
  iconUrl?: string;
}

type MediaType = 'Movie' | 'TvSeries' | 'Anime';

interface MediaItem {
  name: string;
  url: string;
  type: MediaType;
  posterUrl: string;
  year?: number | null;
  score?: number | null;
}

interface HomeSection {
  name: string;
  list: MediaItem[];
}

interface MediaDetails {
  name: string;
  url: string;
  type: MediaType;
  posterUrl: string;
  plot?: string;
  year?: number | null;
  tags?: string[];
  score?: number | null;
  duration?: number | null;
  // Movie
  dataUrl?: string;
  // TvSeries
  episodes?: Episode[];
  recommendations?: MediaItem[];
}

interface Episode {
  name: string;
  season: number;
  episode: number;
  data: string;
}

interface StreamLink {
  name: string;
  url: string;
  quality: string;
  referer?: string;
}

interface PluginAPI {
  manifest: PluginManifest;
  getHome(): Promise<HomeSection[]>;
  search(query: string): Promise<MediaItem[]>;
  load(url: string): Promise<MediaDetails>;
  loadLinks(data: string): Promise<StreamLink[]>;
}
```

### Utilitários fornecidos ao plugin (Sandbox)

O plugin **não terá acesso** a `require`, `fs`, `process`, etc. Ele receberá apenas:

| Utilitário | Descrição |
|---|---|
| `http.get(url, opts)` | Wrapper do axios para GET |
| `http.post(url, body, opts)` | Wrapper do axios para POST |
| `html.parse(htmlString)` | Wrapper do cheerio para parsear HTML |
| `console.log/warn/error` | Logging controlado |

Os plugins continuam sendo `.js`, mas executam dentro de um `vm` que só expõe essas APIs.

---

## Decisão: Novo Projeto vs Reescrita

> **IMPORTANTE**: Vamos criar um **projeto novo** na mesma pasta (`cloudstreamweb`), fazendo backup do conteúdo atual. Os plugins `.js` e extractors existentes serão **migrados** para o novo formato.

---

## Mudanças Propostas

### Estrutura de Pastas

```
cloudstreamweb/
├── client/                       ← Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── media/
│   │   │   │   ├── MediaCard.tsx
│   │   │   │   ├── MediaCarousel.tsx
│   │   │   │   └── EpisodeList.tsx
│   │   │   ├── player/
│   │   │   │   └── VideoPlayer.tsx
│   │   │   └── search/
│   │   │       └── SearchBar.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── DetailsPage.tsx
│   │   │   └── WatchPage.tsx
│   │   ├── hooks/
│   │   │   ├── usePlugins.ts
│   │   │   └── useApi.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/                       ← Backend Express
│   ├── src/
│   │   ├── plugins/              ← Plugins .js ficam aqui
│   │   │   ├── visioncine.js
│   │   │   └── pobreflix.js
│   │   ├── extractors/
│   │   │   ├── mixdrop.js
│   │   │   ├── filemoon.js
│   │   │   ├── doodstream.js
│   │   │   └── streamtape.js
│   │   ├── utils/
│   │   │   └── jsUnpacker.js
│   │   ├── core/
│   │   │   ├── pluginLoader.ts     ← VM sandbox + validação de tipos
│   │   │   ├── pluginRegistry.ts   ← Registro de plugins carregados
│   │   │   ├── extractorManager.ts
│   │   │   └── pluginSandbox.ts    ← Define o contexto seguro do VM
│   │   ├── routes/
│   │   │   ├── plugins.ts
│   │   │   └── stream.ts
│   │   └── server.ts
│   ├── tsconfig.json
│   └── package.json
│
└── shared/                       ← Tipos compartilhados
    └── types.ts
```

---

### Backend (server/)

#### `server/src/core/pluginSandbox.ts`
- Usa `vm.createContext()` para criar ambiente isolado
- Injeta apenas `http`, `html`, e `console` no contexto
- Plugin não tem acesso a `require`, `fs`, `process`, `__dirname`

#### `server/src/core/pluginLoader.ts`
- Lê arquivos `.js` da pasta `plugins/`
- Executa cada plugin dentro do sandbox
- Valida que o objeto exportado implementa o contrato `PluginAPI`
- Faz sanitização dos dados retornados (remove campos extras)

#### `server/src/core/pluginRegistry.ts`
- Armazena plugins carregados em memória
- Métodos: `getAll()`, `getById()`, `reload()`

#### `server/src/routes/plugins.ts`
- `GET /api/plugins` → lista plugins
- `GET /api/plugins/:id/home` → home do plugin
- `GET /api/plugins/search?q=...` → busca **em todos os plugins** (paralelo)
- `POST /api/plugins/:id/load` → detalhes
- `POST /api/plugins/:id/links` → streaming links

#### `server/src/routes/stream.ts`
- `GET /api/stream` → proxy de streaming (migrado do atual)

#### Plugins e Extractors existentes
- Copiar `visioncine.js`, `pobreflix.js` para `server/src/plugins/`
- Copiar extractors para `server/src/extractors/`
- Adaptar para funcionar com as APIs do sandbox (`http.get` ao invés de `axios`)

---

### Frontend (client/)

#### `client/src/App.tsx`
- React Router com rotas: `/`, `/search`, `/details/:pluginId/:encodedUrl`, `/watch`
- Provider do HeroUI + tema dark

#### `client/src/components/layout/Navbar.tsx`
- Logo "CloudStreamWeb"
- Barra de busca central integrada
- Seletor de plugins (dropdown com ícone)

#### `client/src/pages/HomePage.tsx`
- Carrosséis horizontais por categoria (estilo Netflix)
- Cada seção com scroll lateral via HeroUI
- Cards com poster, título, nota e ano

#### `client/src/pages/SearchPage.tsx`
- Resultados agrupados por plugin
- Busca em todos os plugins simultaneamente
- Loading skeleton enquanto carrega

#### `client/src/pages/DetailsPage.tsx`
- Hero banner com poster de fundo
- Sinopse, tags, ano, duração, nota
- Para séries: accordion de temporadas com lista de episódios
- Botão "Assistir" que busca links

#### `client/src/pages/WatchPage.tsx`
- Player de vídeo (HLS.js + video nativo)
- Lista de servidores disponíveis
- Título do que está sendo assistido

#### `client/src/components/media/MediaCard.tsx`
- Card do HeroUI com poster, gradiente escuro
- Badges de ano e nota
- Hover com efeito de escala

#### `client/src/components/media/MediaCarousel.tsx`
- Scroll horizontal com botões de navegação
- Título da seção

---

## Perguntas em Aberto

1. **Sandbox vs require simples**: A abordagem com `vm` do Node.js adiciona complexidade mas dá segurança real. Se preferir manter simples (já que é uso pessoal), podemos usar `require()` direto com validação de tipos apenas.

2. **Migração dos plugins**: Os plugins atuais usam `axios` e `cheerio` direto via `require()`. Na abordagem sandbox, precisarão ser adaptados para usar `http.get()` e `html.parse()` (wrappers).

3. **Novo projeto ou reescrita?** Criar na mesma pasta (`cloudstreamweb`) com backup, ou pasta nova (`cloudstreamweb-v2`)?

---

## Plano de Verificação

### Testes Automatizados
- Scripts de verificação básica para o backend
- Build do frontend com `npm run build` para garantir compilação TypeScript

### Verificação Manual
1. Iniciar servidor e verificar logs de plugins carregados
2. Iniciar frontend
3. Testar fluxo completo no navegador:
   - Verificar plugins na sidebar/navbar
   - Ver carrosséis carregando
   - Pesquisar e ver resultados de todos os plugins
   - Clicar em item → detalhes → assistir
4. Comparar com o protótipo
