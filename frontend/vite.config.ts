import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo, /api se reenvía a la API local: el navegador ve un solo origen (como en Docker)
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  preview: { port: 4173, strictPort: true },
  // Sin source maps en producción: no se publica el código fuente
  build: { sourcemap: false },
});
