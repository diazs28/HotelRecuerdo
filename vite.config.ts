import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// URL pública (enlace canónico y vista previa en redes). En Vercel se toma el dominio de producción.
const dominioVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const sitioUrl = (
  process.env.SITIO_URL ?? (dominioVercel ? `https://${dominioVercel}` : 'http://localhost:5180')
).replace(/\/$/, '');

// Demostración: el modo demo queda fijo en el código (no depende de variables de entorno)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'url-del-sitio',
      transformIndexHtml: (html) => html.replaceAll('%SITIO_URL%', sitioUrl),
    },
  ],
  define: { 'import.meta.env.VITE_MODO_DEMO': JSON.stringify('true') },
  server: { port: 5180 },
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
});
