import axios from 'axios';
import { Request, Response, Router } from 'express';
import zlib from 'zlib';

export const streamRoutes = Router();

streamRoutes.get('/stream', async (req: Request, res: Response) => {
  const { url: targetUrl, referer } = req.query as { url?: string; referer?: string };
  if (!targetUrl) return res.status(400).send('URL is required');

  const isSegment = targetUrl.match(/\.(m4s|ts|m4v|m4a|m4b|m4p)$/) || targetUrl.includes('/seg-') || targetUrl.includes('/fragment-');
  if (!isSegment) {
    console.log(`[Stream Proxy] Requesting: ${targetUrl.substring(0, 100)}...`);
    console.log(`[Stream Proxy] Client Range: ${req.headers.range || 'None'}`);
  }

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

    if (!isSegment) {
      console.log(`[Stream Proxy] Source Status: ${response.status}`);
    }

    // Explicitly select headers to forward
    let contentType = response.headers['content-type']?.toString();
    const { type } = req.query as { type?: string };

    const isM3U8 = (
      (targetUrl.split('?')[0].endsWith('.m3u8') || contentType?.includes('mpegurl') || contentType?.includes('application/x-mpegURL')) && 
      response.status === 200 &&
      type !== 'mp4'
    );

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
      console.log(`[Stream Proxy] Checking if is real M3U8 manifest: ${targetUrl.substring(0, 100)}`);
      
      const isGzip = response.headers['content-encoding'] === 'gzip';
      let dataStream = response.data;

      if (isGzip) {
        dataStream = response.data.pipe(zlib.createGunzip());
      }

      let manifestText = '';
      let isRealM3U8 = false;
      const chunks: any[] = [];

      try {
        for await (const chunk of dataStream) {
          chunks.push(chunk);
          manifestText += chunk.toString();
          
          // Check early if it's a real M3U8
          if (!isRealM3U8 && manifestText.length >= 7) {
            if (manifestText.trimStart().startsWith('#EXTM3U')) {
              isRealM3U8 = true;
            } else {
              // Not a real M3U8, break and stream directly
              console.log('[Stream Proxy] Not a real M3U8 manifest, falling back to direct stream.');
              break;
            }
          }

          // Safety limit: Don't buffer more than 2MB for a manifest
          if (Buffer.concat(chunks).length > 2 * 1024 * 1024) {
            console.log('[Stream Proxy] Manifest too large (>2MB), falling back to direct stream.');
            isRealM3U8 = false;
            break;
          }
        }

        if (isRealM3U8) {
          const baseUrl = new URL(targetUrl);
          const host = req.get('host');
          const protocol = req.protocol;
          const proxyBaseUrl = `${protocol}://${host}${req.baseUrl}/stream`;

          const lines = manifestText.split('\n');
          const rewrittenLines = lines.map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#EXT-X-KEY')) return line;

            const proxyWrap = (rawUrl: string) => {
              try {
                const resolvedUrl = new URL(rawUrl, baseUrl).href;
                return `${proxyBaseUrl}?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer || targetUrl)}`;
              } catch (e) {
                return rawUrl;
              }
            };

            if (trimmedLine.startsWith('#')) {
              return line.replace(/URI="(.*?)"/g, (match, p1) => {
                return `URI="${proxyWrap(p1)}"`;
              });
            }

            return proxyWrap(trimmedLine);
          });

          const finalManifest = rewrittenLines.join('\n');
          forwardHeaders['Content-Length'] = Buffer.byteLength(finalManifest).toString();
          delete forwardHeaders['Content-Encoding'];

          res.writeHead(response.status, forwardHeaders);
          res.end(finalManifest);
          return;
        } else {
          // Fallback to direct stream for the remaining data
          res.writeHead(response.status, forwardHeaders);
          
          // We need to send the chunks we already read
          const combinedBuffer = Buffer.concat(chunks);
          res.write(combinedBuffer);

          // And pipe the rest
          dataStream.pipe(res);
          return;
        }
      } catch (err: any) {
        console.error(`[Stream Proxy] Error processing manifest: ${err.message}`);
        // If we fail during processing, try to pipe the rest if possible or just end
        if (!res.headersSent) {
          res.writeHead(response.status, forwardHeaders);
          dataStream.pipe(res);
        } else {
          res.end();
        }
        return;
      }
    }

    // For non-m3u8 streams (segments, mp4), keep compression if present and pipe directly
    if (response.headers['content-encoding']) {
      forwardHeaders['Content-Encoding'] = response.headers['content-encoding'].toString();
    }

    res.writeHead(response.status, forwardHeaders);
    response.data.pipe(res);

    req.on('close', () => {
      if (!isSegment) {
        console.log('[Stream Proxy] Client closed connection.');
      }
      controller.abort();
      response.data.destroy();
    });

    response.data.on('error', (err: any) => {
      // Silencia erros comuns de cancelamento de conexão no streaming (comportamento normal do player)
      const isCanceled = err.message === 'canceled' || err.code === 'ECONNRESET' || err.message?.includes('aborted');
      if (isCanceled) return;
      
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
