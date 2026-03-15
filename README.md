# CloudStreamWeb

Versão web do CloudStream — plataforma de streaming baseada em plugins.

## Requisitos

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
