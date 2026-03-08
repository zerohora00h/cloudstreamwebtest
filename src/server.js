const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const pluginsManager = require('./pluginsManager');
const extractorsManager = require('./extractorsManager');

// Desabilita verificação de SSL (necessário para alguns sites de streaming com certificados problemáticos)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../public')));

// Carregar plugins
pluginsManager.loadPlugins(path.join(__dirname, 'plugins'));

// Rotas da API
app.get('/api/plugins', (req, res) => {
  res.json(pluginsManager.getPluginsList());
});

app.get('/api/plugin/:id/home', async (req, res) => {
  try {
    const plugin = pluginsManager.getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: 'Plugin não encontrado' });

    const data = await plugin.getHome();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/plugin/:id/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Query de busca é obrigatória' });

    const plugin = pluginsManager.getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: 'Plugin não encontrado' });

    const data = await plugin.search(query);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugin/:id/load', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    const plugin = pluginsManager.getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: 'Plugin não encontrado' });

    const data = await plugin.load(url);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugin/:id/loadLinks', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Dados são obrigatórios' });

    const plugin = pluginsManager.getPlugin(req.params.id);
    if (!plugin) return res.status(404).json({ error: 'Plugin não encontrado' });

    const rawLinks = await plugin.loadLinks(data);
    const finalLinks = [];

    // Tentar extrair links diretos para cada link bruto encontrado
    for (const link of rawLinks) {
      if (link.url) {
        console.log(`[Extractor] Tentando extrair: ${link.url}`);
        const extracted = await extractorsManager.extract(link.url);

        if (extracted && extracted.length > 0) {
          extracted.forEach(e => {
            console.log(`[Extractor] Link extraído com sucesso: ${e.url}`);

            // Centraliza a lógica de proxy aqui:
            // Transforma o link direto em um link de proxy do nosso servidor
            const proxyUrl = `/api/stream?url=${encodeURIComponent(e.url)}&referer=${encodeURIComponent(e.referer || link.url)}`;

            finalLinks.push({
              ...e,
              url: proxyUrl
            });
          });
        } else {
          console.log(`[Extractor] Nenhuma extração direta disponível para: ${link.url}`);
          finalLinks.push(link);
        }
      } else {
        finalLinks.push(link);
      }
    }

    res.json(finalLinks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy de Streaming Global
app.get('/api/stream', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('URL de vídeo é obrigatória');

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer || url,
      'Accept': '*/*',
      'Connection': 'keep-alive'
    };

    // Suporte a busca (seeking) via Range headers
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const videoResponse = await axios({
      method: 'get',
      url: url,
      headers: headers,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5
    });

    const forwardHeaders = {
      'Content-Type': videoResponse.headers['content-type'] || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*' // Adicionado para evitar problemas de CORS no player
    };

    if (videoResponse.headers['content-length']) forwardHeaders['Content-Length'] = videoResponse.headers['content-length'];
    if (videoResponse.headers['content-range']) forwardHeaders['Content-Range'] = videoResponse.headers['content-range'];

    res.writeHead(videoResponse.status, forwardHeaders);
    videoResponse.data.pipe(res);

    videoResponse.data.on('error', (err) => {
      res.end();
    });

  } catch (error) {
    console.error(`[Stream Proxy] Erro: ${error.message}${error.response ? ` (Status: ${error.response.status})` : ''}`);
    if (error.response && error.response.status === 403) {
      console.log(`[Stream Proxy] Dica: O MixDrop pode ter invalidado o token ou o Referer está incorreto.`);
    }
    res.status(error.response?.status || 500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Servidor rodando em http://localhost:${PORT}`);
});
