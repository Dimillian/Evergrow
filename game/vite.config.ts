import { defineConfig } from 'vite';
import { captureExport } from './scripts/capture-export.ts';
export default defineConfig({ define: { 'import.meta.env.VITE_LOCAL_COMMANDS': process.env.VITE_SITE_CLOUD !== 'true' }, plugins: [captureExport()], server: { host: '127.0.0.1', port: 5173, strictPort: true } });
