import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { ABOUT, APP_VERSION, PRIVACY, PRIVACY_UPDATED } from './src/legal/privacy';

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

/** Página pública de privacidad (la que se enlaza en las tiendas), con el mismo texto que el juego */
function privacyPage(): Plugin {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    name: 'fowner-privacidad',
    apply: 'build',
    generateBundle() {
      const secciones = PRIVACY.map((s) => `<h2>${esc(s.title)}</h2>\n${s.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}`).join('\n');
      const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fowner · Política de privacidad</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f8f6; --text: #1b1f1c; --muted: #5d665f; --accent: #0f5132; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0c1410; --text: #e8efe9; --muted: #9aa8a0; --accent: #5fd08f; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 1.7rem; margin: 0 0 4px; }
  h2 { font-size: 1.1rem; margin: 28px 0 6px; color: var(--accent); }
  .muted { color: var(--muted); font-size: 0.9rem; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
<h1>Fowner · Política de privacidad</h1>
<p class="muted">Última actualización: ${esc(PRIVACY_UPDATED)} · Versión ${esc(APP_VERSION)}</p>
${secciones}
<h2>Acerca de Fowner</h2>
${ABOUT.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<p><a href="./">Volver al juego</a></p>
</main>
</body>
</html>
`;
      this.emitFile({ type: 'asset', fileName: 'privacidad.html', source: html });
    },
  };
}

// base relativa para poder publicar en cualquier subruta (Netlify, Vercel, Cloudflare Pages...)
export default defineConfig({
  base: './',
  plugins: [react(), privacyPage(), serviceWorker()],
  // el mapa 3D (three.js) va en un trozo aparte que solo se descarga al abrir Instalaciones
  build: { chunkSizeWarningLimit: 700 },
});
