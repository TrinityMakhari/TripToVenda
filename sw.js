// Trip To Venda service worker — lets the app open offline and install on phones.
const CACHE = 'ttv-v21';
const FILES = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png', './favicon-64.png', './img/emblem.webp', './img/logo-light.svg', './img/hero.jpg', './img/thohoyandou.jpg', './img/gauteng.jpg', './img/pretoria.jpg', './img/durban.jpg', './img/capetown.jpg', './img/n1.jpg', './img/drive.jpg', './img/traveller.jpg', './img/parcel.jpg', './img/hero-driver.jpg', './img/hero-rider-f.jpg', './img/hero-rider-m.jpg', './lib/leaflet/leaflet.js', './lib/leaflet/leaflet.css', './lib/routes.js', './lib/basemap.js', './lib/firebase.js', './firebase-config.js', './cloud.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // only the app's own files and map tiles; live data (Firebase, Google) always goes straight to the network and is never stored
  const u = new URL(e.request.url);
  if (u.origin !== location.origin && !/tile/.test(u.hostname)) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
