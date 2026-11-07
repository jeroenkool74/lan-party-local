import { defineConfig } from 'vite';

// `vite build web` (see package.json) uses this directory as the root.
export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
