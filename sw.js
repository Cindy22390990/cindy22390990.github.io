// sw.js — Service Worker (PWA)
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `english-notebook-${CACHE_VERSION}`;

// 盡量只快取「同網域」的核心檔案；外部資源改成動態快取，避免跨網域被擋
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 安裝：預快取核心資產
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// 啟用：清掉舊版快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// 取用策略：
// 1) 對本機檔案（同網域）走「快取優先，失敗再網路」(Cache First)
// 2) 對外部資源（fonts、Tailwind、Google APIs）走「先網路、失敗再快取」(Stale-While-Revalidate-ish)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // 本站資源：Cache First
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((resp) => {
          // 放進快取以備下次離線使用
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
      )
    );
  } else {
    // 外部資源：Network First，失敗再回快取
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// 導航請求的後備：離線時回 index.html（SPA/單頁應用好用）
self.addEventListener('fetch', (event) => {
  if (
    event.request.mode === 'navigate' &&
    event.request.method === 'GET'
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
  }
});
