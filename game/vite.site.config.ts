import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
export default defineConfig({ root: '..', plugins: [sites()],
  define: { 'import.meta.env.VITE_SITE_CLOUD': 'true', 'import.meta.env.VITE_LOCAL_COMMANDS': false },
  build: { outDir: 'dist', emptyOutDir: true, ssr: 'game/server/worker.ts',
    rollupOptions: { output: { entryFileNames: 'server/index.js' } } }, ssr: { noExternal: true },
});
