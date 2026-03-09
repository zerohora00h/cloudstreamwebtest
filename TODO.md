# CloudStreamWeb — TODO List

## Planejamento
- [x] Analisar projeto existente (plugins, server, extractors, frontend)
- [x] Escrever plano de implementação detalhado
- [x] Responder perguntas em aberto → require simples + validação, mesma pasta com backup

## Inicialização do Projeto
- [x] Criar projeto Vite + React + TypeScript
- [x] Configurar Tailwind CSS v4
- [x] Configurar HeroUI (tema dark + paleta indigo)
- [x] Configurar Express (backend separado com TypeScript)
- [x] Copiar plugins/extractors existentes para server/src/
- [x] Criar comando para iniciar ambos simultaneamente (root package.json)

## Sistema de Tipos e Plugin Registry
- [x] Definir tipos TypeScript para o contrato de plugins (`shared/types.ts`)
- [x] Criar PluginRegistry tipado com sanitização de retornos
- [x] Criar ExtractorManager tipado

## Backend API (Express)
- [x] Configurar servidor Express com TypeScript
- [x] Rota `GET  /api/plugins` — listar plugins
- [x] Rota `GET  /api/plugins/:id/home` — home do plugin
- [x] Rota `GET  /api/plugins/search?q=...` — busca multi-plugin
- [x] Rota `POST /api/plugins/:id/load` — detalhes de conteúdo
- [x] Rota `POST /api/plugins/:id/links` — links de streaming
- [x] Rota `GET  /api/stream` — proxy de streaming

## Frontend (React + HeroUI)
- [x] Layout principal (Navbar + tema dark)
- [x] Página Home com carrosséis por categoria
- [x] Componente MediaCard (poster + badges)
- [x] Componente MediaCarousel (scroll horizontal)
- [x] Página de Busca (multi-plugin, resultados agrupados)
- [x] Página de Detalhes (hero banner, sinopse, episódios)
- [x] Página de Player (vídeo HLS.js, lista de servidores)
- [x] Seletor de plugins
- [x] Design premium estilo streaming

## Verificação
- [ ] Testar carregamento de plugins existentes
- [ ] Testar busca multi-plugin
- [ ] Testar fluxo completo: home → detalhes → player
- [ ] Build de produção sem erros
