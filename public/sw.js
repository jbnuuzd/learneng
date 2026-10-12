// App-shell cache: the app opens offline (installable PWA); /api is never cached.
const CACHE = 'learneng-shell-v7';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/css/styles.css', '/js/main.js']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // network first (a new deploy is always picked up whole), the cached copy only when offline
  e.respondWith(caches.open(CACHE).then((c) => fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })
    .catch(async () => (await c.match(req)) || (req.mode === 'navigate' ? c.match('/') : Response.error()))));
});
