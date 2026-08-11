const CACHE_NAME = 'weight-app-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/backup.js',
  './js/bmi.js',
  './js/chart.js',
  './js/dateUtils.js',
  './js/graphView.js',
  './js/profile.js',
  './js/recordForm.js',
  './js/records.js',
  './js/settingsView.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
// 注意: app-sync(共有モジュール)のURLはキャッシュしない。
// オフライン時はどのみち保存できず、キャッシュすると更新が届かなくなるため。

self.addEventListener('install', (event) => {
  // cache:'reload'でブラウザHTTPキャッシュを迂回する。素のaddAllだと、
  // 古いHTTPキャッシュの内容が新しいキャッシュ名の箱に入り込み、
  // 以後どれだけ再起動しても旧版が配信され続ける事故が起きる。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
