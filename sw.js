// Service Worker: improved caching for faster, fresher gallery images
const CACHE_NAME = 'site-cache-v4';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.webmanifest',
  '/assets/favicon.svg',
  '/assets/placeholder.jpg'
];

// On install: cache only the app shell (don't precache all gallery images)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

// On activate: delete old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// Helper: network-first strategy for images with cache fallback and timeout
async function networkFirstImage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // small network timeout so slow connections fall back to cached images
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // fallback to placeholder from cache or network
    const placeholder = await cache.match('/assets/placeholder.jpg');
    if (placeholder) return placeholder;
    return fetch('/assets/placeholder.jpg').catch(() => new Response('', { status: 503 }));
  }
}

// Fetch handler: route images (assets) with network-first; use cache-first for shell and other static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Always prefer fresh CSS/JS, cache the latest as fallback (stale-while-revalidate style)
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const net = await fetch(request);
          if (net && net.ok) cache.put(request, net.clone()).catch(() => {});
          return net;
        } catch (_) {
          const cached = await cache.match(request);
          return cached || fetch(request);
        }
      })()
    );
    return;
  }

  // Images under /assets/ -> network-first with cache fallback
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(networkFirstImage(request));
    return;
  }

  // HTML navigation requests -> network-first, fallback to cached index.html
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request).then((resp) => {
        // update cache with latest HTML
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Other requests: try cache-first, then network and cache response
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        // only cache successful responses
        if (!resp || !resp.ok) return resp;
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached);
    })
  );
});

// Allow page to trigger skipWaiting (optional)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
