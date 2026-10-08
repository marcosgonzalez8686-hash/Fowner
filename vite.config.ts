import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Genera el service worker con la lista de todos los archivos del juego para jugar sin conexión */
function serviceWorker(): Plugin {
  return {
    name: 'fowner-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicos = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
      const archivos = [...publicos, ...Object.keys(bundle).filter((f) => f !== 'sw.js').map((f) => `./${f}`)];
      const version = createHash('sha1').update(archivos.join('|')).digest('hex').slice(0, 10);
      const plantilla = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: plantilla.replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify([...new Set(archivos)], null, 2)),
      });
    },
  };
}

// base relativa para poder publicar en cualquier subruta (Netlify, Vercel, Cloudflare Pages...)
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  // el mapa 3D (three.js) va en un trozo aparte que solo se descarga al abrir Instalaciones
  build: { chunkSizeWarningLimit: 700 },
});
