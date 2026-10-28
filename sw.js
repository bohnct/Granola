// Service worker: app files cache-first (offline), price data network-first.
// Bump VERSION whenever app files change so phones pick up the new version.
const VERSION = 'basis-v4';
const APP_CACHE = `app-${VERSION}`;
const DATA_CACHE = 'data';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/ui.js', 'js/theme.js', 'js/data.js', 'js/prefs.js', 'js/chart.js',
  'js/bids.js', 'js/history.js', 'js/basis.js', 'js/monthschart.js', 'js/ranges.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/data/')) {
    // Network first; fall back to the last saved copy when offline.
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(DATA_CACHE).then((c) => c.put(url.pathname, copy));
      }
      return res;
    }).catch(() => caches.match(url.pathname, { cacheName: DATA_CACHE }).then((r) => r || Response.error())));
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
