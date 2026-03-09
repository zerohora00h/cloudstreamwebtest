import axios from 'axios';
import { Request, Response, Router } from 'express';

export const streamRoutes = Router();

streamRoutes.get('/stream', async (req: Request, res: Response) => {
  const { url: targetUrl, referer } = req.query as { url?: string; referer?: string };
  if (!targetUrl) return res.status(400).send('URL is required');

  console.log(`[Stream Proxy] Requesting: ${targetUrl.substring(0, 100)}...`);
  console.log(`[Stream Proxy] Client Range: ${req.headers.range || 'None'}`);

  const controller = new AbortController();

  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || targetUrl,
        'Range': req.headers.range,
        'Accept': '*/*',
        'Connection': 'keep-alive',
      },
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 10,
      signal: controller.signal,
      decompress: false, // CRITICAL: Do not let axios decompress, pass raw bytes!
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    console.log(`[Stream Proxy] Source Status: ${response.status}`);

    // Explicitly select headers to forward
    let contentType = response.headers['content-type'];
    if (!contentType || contentType === 'application/octet-stream') {
      if (targetUrl.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else contentType = 'video/mp4';
    }

    const forwardHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Referer, User-Agent',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Cache-Control': 'no-cache',
    };

    if (response.headers['content-length']) forwardHeaders['Content-Length'] = response.headers['content-length'];
    if (response.headers['content-range']) forwardHeaders['Content-Range'] = response.headers['content-range'];
    if (response.headers['content-encoding']) forwardHeaders['Content-Encoding'] = response.headers['content-encoding'];

    res.writeHead(response.status, forwardHeaders);

    response.data.pipe(res);

    req.on('close', () => {
      console.log('[Stream Proxy] Client closed connection.');
      controller.abort();
      response.data.destroy();
    });

    response.data.on('error', (err: any) => {
      console.error(`[Stream Proxy] Stream pipe error: ${err.message}`);
      res.end();
    });

  } catch (error: any) {
    console.error(`[Stream Proxy] Error: ${error.message} - ${error.response?.status}`);
    if (!res.headersSent) {
      const status = error.response?.status || 500;
      res.status(status).send(error.message);
    } else {
      res.end();
    }
  }
});
