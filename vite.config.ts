import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': new URL('./src/engine', import.meta.url).pathname,
      '@shared': new URL('./src/shared', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        app: new URL('./src/web/index.html', import.meta.url).pathname,
        q: new URL('./src/web/q.html', import.meta.url).pathname,
      },
      output: {
        manualChunks: {
          pdf: ['pdfmake'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
