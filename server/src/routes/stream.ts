import axios from 'axios';
import { Request, Response, Router } from 'express';
import zlib from 'zlib';

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
    let contentType = response.headers['content-type']?.toString();
    const isM3U8 = (targetUrl.split('?')[0].endsWith('.m3u8') || contentType?.includes('mpegurl') || contentType?.includes('application/x-mpegURL')) && response.status === 200;

    if (!contentType || contentType === 'application/octet-stream') {
      if (isM3U8) contentType = 'application/vnd.apple.mpegurl';
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

    if (response.headers['content-length']) forwardHeaders['Content-Length'] = response.headers['content-length'].toString();
    if (response.headers['content-range']) forwardHeaders['Content-Range'] = response.headers['content-range'].toString();

    // If it's a manifest, we need to rewrite it to handle relative URLs
    if (isM3U8) {
      console.log(`[Stream Proxy] Rewriting M3U8 manifest: ${targetUrl.substring(0, 100)}`);
      
      const isGzip = response.headers['content-encoding'] === 'gzip';
      let dataStream = response.data;

      if (isGzip) {
        console.log('[Stream Proxy] Decompressing GZIP manifest...');
        dataStream = response.data.pipe(zlib.createGunzip());
      }

      let manifestText = '';
      for await (const chunk of dataStream) {
        manifestText += chunk.toString();
      }

      const baseUrl = new URL(targetUrl);
      const host = req.get('host');
      const protocol = req.protocol;
      const proxyBaseUrl = `${protocol}://${host}${req.baseUrl}/stream`;

      const lines = manifestText.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine === '' || trimmedLine.startsWith('#EXT-X-KEY')) return line; // Skip keys for now or handle them

        // Helper to wrap URL in proxy
        const proxyWrap = (rawUrl: string) => {
          try {
            const resolvedUrl = new URL(rawUrl, baseUrl).href;
            return `${proxyBaseUrl}?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer || targetUrl)}`;
          } catch (e) {
            return rawUrl;
          }
        };

        // If it starts with #, it's a tag. We need to check for URI="..."
        if (trimmedLine.startsWith('#')) {
          return line.replace(/URI="(.*?)"/g, (match, p1) => {
            return `URI="${proxyWrap(p1)}"`;
          });
        }

        // Otherwise it's a direct URL line
        return proxyWrap(trimmedLine);
      });

      const finalManifest = rewrittenLines.join('\n');
      forwardHeaders['Content-Length'] = Buffer.byteLength(finalManifest).toString();
      
      // Remove encoding header since we've decompressed and rewritten to plain text
      delete forwardHeaders['Content-Encoding'];

      res.writeHead(response.status, forwardHeaders);
      res.end(finalManifest);
      return;
    }

    // For non-m3u8 streams (segments, mp4), keep compression if present and pipe directly
    if (response.headers['content-encoding']) {
      forwardHeaders['Content-Encoding'] = response.headers['content-encoding'].toString();
    }

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
