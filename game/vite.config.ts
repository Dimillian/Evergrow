import { defineConfig } from 'vite';
import { captureExport } from './scripts/capture-export.ts';
export default defineConfig({ plugins: [captureExport()], server: { host: '127.0.0.1', port: 5173, strictPort: true } });
