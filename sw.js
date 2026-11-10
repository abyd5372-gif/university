/* Service worker: caches the app shell, and book summaries you have already opened (readable offline). */
const VERSION = 'uni-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(fallbackUrl || request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw error;
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(VERSION), cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request); if (response && response.ok) cache.put(request, response.clone()); return response;
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION), cached = await cache.match(request);
  const fresh = fetch(request).then(response => { if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === location.origin) { event.respondWith(networkFirst(request, 'index.html')); return; }
  if (url.origin === location.origin && /\.(?:png|webmanifest)$/.test(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
  if (url.hostname.endsWith('workers.dev') && url.searchParams.get('action') === 'book-summary') { event.respondWith(networkFirst(request)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(staleWhileRevalidate(request)); return; }
});
