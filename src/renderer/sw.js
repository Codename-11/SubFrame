const CACHE_NAME = 'subframe-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/dist/web-renderer.js',
  '/dist/renderer.css',
  '/node_modules/xterm/css/xterm.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for API/WS, cache-first for shell assets
  if (event.request.url.includes('/ws') || event.request.url.includes('/api/')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
