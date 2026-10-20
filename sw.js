'use strict';

// v4：修复升级时新旧文件混搭导致白屏的问题。
// 原则：页面和代码永远以网络为准，缓存只做离线兜底。
const CACHE_NAME = 'rrb-chores-shell-v4';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './quotes.js',
  './celebrations.js',
  './app.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // 预缓存尽力而为：单个资源失败不允许拖垮整个安装
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
      // 让已经打开的旧页面立即刷新成新版本，用户不用手动关两次
      const clientList = await self.clients.matchAll({ type: 'window' });
      clientList.forEach((client) => {
        try {
          if (client.url && client.url.startsWith('http')) client.navigate(client.url);
        } catch (error) { /* 忽略不可导航的窗口 */ }
      });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML / JS / CSS / manifest：网络优先，杜绝新旧混搭；断网才用缓存兜底
  const isDoc = request.mode === 'navigate' || /\.html?$/.test(url.pathname);
  const isCode = /\.(js|css|json)$/.test(url.pathname);

  if (isDoc || isCode) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request, { ignoreSearch: true }))
            || (await cache.match('./index.html'))
            || Response.error();
        })
    );
    return;
  }

  // 图片等静态资源：先用缓存，后台静默更新
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
