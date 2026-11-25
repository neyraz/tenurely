/* Service worker for Faculty Market Atlas.
   It keeps a copy of the app so it opens offline and can be installed.
   It only handles files from this site. Requests to Google go straight to the network, untouched,
   and no sheet data is ever stored here (the app keeps its own copy in the browser's IndexedDB). */
const VERSION = 'atlas-__VERSION__';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // not ours: let the browser handle it

  // The page itself: try the network first so updates arrive, fall back to the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); } return res; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Everything else from this site (icons, manifest): saved copy first.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
