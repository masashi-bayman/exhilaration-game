/* ============================================================
   sw.js  --  オフライン再生用 Service Worker
   キャッシュ優先。ファイルを更新したら CACHE の版数を上げること。
   ============================================================ */
var CACHE = 'exhilaration-v5';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/audio.js',
  './js/fx.js',
  './js/levels.js',
  './js/upgrades.js',
  './js/game.js',
  './js/render.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 1つ失敗しても全体が落ちないように個別に入れる
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移はキャッシュの index.html にフォールバック
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true })
          .then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        // 裏で更新しておく
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
