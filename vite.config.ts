import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa para poder publicar en cualquier subruta (Netlify, Vercel, Cloudflare Pages...)
export default defineConfig({
  base: './',
  plugins: [react()],
});
