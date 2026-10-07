import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa para poder publicar en cualquier subruta (Netlify, Vercel, Cloudflare Pages...)
export default defineConfig({
  base: './',
  plugins: [react()],
  // el mapa 3D (three.js) va en un trozo aparte que solo se descarga al abrir Instalaciones
  build: { chunkSizeWarningLimit: 700 },
});
