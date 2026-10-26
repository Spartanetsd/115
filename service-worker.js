/* СЛОВО 115 — Service Worker для офлайн-роботи.
   ПІСЛЯ ОНОВЛЕННЯ ФАЙЛІВ У РЕПОЗИТОРІЇ збільшіть VERSION (наприклад, v1.0.1) —
   тоді застосунок запропонує користувачам оновитися. */
const VERSION = 'slovo115-v1.0.0';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './data/content-01.js',
  './data/content-02.js',
  './data/content-03.js',
  './data/content-04.js',
  './data/content-05.js',
  './data/content-06.js',
  './data/content-07.js',
  './data/content-08.js',
  './data/topics.js',
  './data/lang.js',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.indexOf('slovo115-') === 0 && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* Спершу кеш (миттєвий запуск і офлайн), паралельно — тиха перевірка оновлень у мережі. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate';
  const key = isPage ? new Request(new URL('./index.html', self.location).href) : req;

  event.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(key, { ignoreSearch: true }).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
          return res;
        }).catch(() => cached);
        if (cached) {
          event.waitUntil(network.catch(() => null));
          return cached;
        }
        return network.then(res => res || new Response('Немає з’єднання з мережею.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      })
    )
  );
});
