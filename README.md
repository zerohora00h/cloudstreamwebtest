# CloudStreamWeb

> [!IMPORTANT]
> **Aviso:** Este projeto foi apenas um teste e não terá mais atualizações.

Versão web do CloudStream — plataforma de streaming baseada em plugins.

## ✨ Principais Funcionalidades

- **Smart Sync**: Sincronização inteligente da home que detecta mudanças e evita requisições desnecessárias.
- **Recursive Prefetch**: Pré-carregamento inteligente de detalhes e links em segundo plano para navegação instantânea.
- **Sistema de Cache**: Cache local via SQLite para carregamento imediato de conteúdos já visitados.
- **Streaming Proxy**: Proxy integrado que gerencia headers e referers para garantir que o vídeo rode em qualquer player e inclusive externos como VLC.
- **Multi-Plugin**: Arquitetura extensível que permite adicionar novos extratores e provedores facilmente.
- **Busca Unificada**: Pesquise em todos os plugins instalados simultaneamente.

## ⚙️ Configurações Disponíveis

No menu de configurações, você pode ajustar:

- **Cache de Dados**: Ativa/Desativa o armazenamento persistente.
- **Sync em Segundo Plano**: Verifica se há novidades na home enquanto você navega.
- **Sync Recursivo (Home/Séries)**: Escolha se o app deve pré-carregar os detalhes de tudo o que aparece na tela.
- **Concorrência Recursiva**: Controle quantos processos simultâneos o prefetch pode usar (recomendado: 2-4).

## 🛠️ Requisitos

- [Node.js](https://nodejs.org/) (v18 ou superior)

## Início Rápido

### Opção 1: Script automático (Windows)

Dê dois cliques no arquivo `INICIAR SERVIDOR.bat` na raiz do projeto.

Ele vai:
1. Verificar se o Node.js está instalado
2. Instalar as dependências automaticamente (apenas na primeira vez)
3. Iniciar o servidor

### Opção 2: Manual (terminal)

```bash
# Instalar dependências (apenas na primeira vez)
npm install

# Iniciar em modo de desenvolvimento
npm run dev
```

## Acessando

Após iniciar, acesse no navegador:

- **Interface**: http://localhost:5173
- **API**: http://localhost:3001

## Estrutura

```
cloudstreamweb/
├── client/          # Frontend (React + Vite)
├── server/          # Backend (Express + SQLite)
│   └── src/
│       └── plugins/ # Plugins de streaming
├── shared/          # Tipos compartilhados
└── INICIAR SERVIDOR.bat  # Script de inicialização
```

## ⚠️ Segurança — Plugins de Terceiros

Plugins são **código que roda diretamente no seu computador**. Tome cuidado ao instalar plugins de outras pessoas.

- ✅ Instale plugins **apenas** dentro da pasta `server/src/plugins/`
- ✅ Use **somente** plugins que a comunidade já analisou e considera seguros
- 🚫 Se um plugin pedir para colocar arquivos **fora** da pasta `plugins/`, **não instale** — isso é suspeito
- 🚫 Desconfie de plugins que acessam arquivos do sistema, fazem downloads externos ou pedem permissões incomuns

> **Na dúvida, peça para alguém da comunidade revisar o código antes de usar.**

## ⚖️ DMCA / Isenção de Responsabilidade

Este projeto tem caráter meramente educacional e funciona de forma semelhante a um navegador comum, apenas buscando arquivos de vídeo disponíveis publicamente na internet.

Nenhum conteúdo é hospedado por este repositório. Qualquer conteúdo acessado é hospedado por sites de terceiros. O uso é de total responsabilidade do usuário, que deve cumprir as leis locais. Se você acredita que algum conteúdo viola direitos autorais, entre em contato diretamente com o provedor que hospeda os arquivos.