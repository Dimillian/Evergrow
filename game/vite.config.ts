import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';
import { captureExport } from './scripts/capture-export.ts';
export default defineConfig({
  plugins: [captureExport()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(import.meta.dirname),
      fileURLToPath(new URL('../music/evergrow-loops/loops', import.meta.url))] },
  },
});
