import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base:'./',
  build:{outDir:'dist-android',rollupOptions:{input:{game:resolve(import.meta.dirname,'index.html'),thor:resolve(import.meta.dirname,'thor.html')}}},
});
