// Service worker: guarda todo el juego al instalarse para poder jugar sin conexión.
// La lista de archivos y la versión las rellena la compilación (vite.config.ts).
const VERSION = '__VERSION__';
const CACHE = `fowner-${VERSION}`;
const ARCHIVOS = __ARCHIVOS__;

self.addEventListener('install', (e) => {
  // se descarga todo (también el mapa 3D) aunque aún no se haya abierto esa pantalla
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // se borran las cachés de versiones anteriores
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('fowner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const url = new URL(req.url);
  // los archivos con huella (assets/) no cambian nunca: primero la caché
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))));
    return;
  }
  // la página y el resto: primero la red (para recibir actualizaciones) y, sin conexión, la caché
  e.respondWith(
    fetch(req)
      .then((res) => guardar(req, res))
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          // cualquier página que no esté guardada abre el juego
          .then((r) => r || caches.match('./index.html'))
          .then((r) => r || caches.match('./')),
      ),
  );
});

function guardar(req, res) {
  if (res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}
