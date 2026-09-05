import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Local dev review export; one named artifact, no caller-controlled filesystem path. */
export function captureExport(): Plugin {
  return { name: 'local-forest-capture', apply: 'serve', configureServer(server) {
    server.middlewares.use('/__forest-recording', (request, response) => {
      const origin = request.headers.origin;
      if (request.method !== 'POST' || origin !== `http://${request.headers.host}`
        || !/^127\.0\.0\.1:\d+$/.test(request.headers.host ?? '')) { response.statusCode = 403; response.end(); return; }
      const mime = request.headers['content-type']?.split(';')[0];
      if (mime !== 'video/webm' && mime !== 'video/mp4') { response.statusCode = 415; response.end(); return; }
      const chunks: Buffer[] = []; let length = 0, excessive = false;
      request.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > 24 * 1024 * 1024) { excessive = true; chunks.length = 0; }
        if (!excessive) chunks.push(chunk);
      });
      request.on('end', () => {
        if (excessive || length === 0) { response.statusCode = 413; response.end(); return; }
        const directory = new URL('../../docs/captures/2026-09-05/living-forest/', import.meta.url);
        const name = `living-forest.${mime === 'video/webm' ? 'webm' : 'mp4'}`;
        void mkdir(directory, { recursive: true }).then(() => writeFile(new URL(name, directory), Buffer.concat(chunks)))
          .then(() => { response.setHeader('Content-Type', 'text/plain'); response.end(fileURLToPath(new URL(name, directory))); })
          .catch(() => { response.statusCode = 500; response.end('Capture export failed.'); });
      });
    });
  } };
}
