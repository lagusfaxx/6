// ─── Cache configuration ───
const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `uzeed-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `uzeed-images-${CACHE_VERSION}`;
const API_CACHE     = `uzeed-api-${CACHE_VERSION}`;

// Assets to pre-cache on install (critical path)
const PRECACHE_URLS = [
  '/brand/bg.jpg',
  '/brand/isotipo-new.png',
  '/manifest.webmanifest',
];

// ─── Install: pre-cache critical assets & clean old caches ───
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
      // Delete caches from previous versions
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('uzeed-') && ![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(n))
            .map((n) => caches.delete(n))
        )
      ),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Fetch strategies ───

/**
 * Cache-first: serve from cache immediately, fall back to network.
 * Used for static assets that rarely change (JS, CSS, brand images).
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Stale-while-revalidate: serve cached version instantly, update cache
 * in the background. Used for API responses and dynamic content.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached); // If network fails, return stale cache

  return cached || fetchPromise;
}

/**
 * Network-first: try network, fall back to cache. Used for HTML pages
 * to always show the freshest content when possible.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Skip WebSocket upgrades and auth/session endpoints
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/messages')) return;

  // ── Static assets: cache-first (JS, CSS bundles) ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Optimized images: cache-first ──
  if (url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/brand/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // ── API GET requests (feed, directory, profiles): stale-while-revalidate ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // ── HTML pages: network-first ──
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }
});

// ─── Push notifications (unchanged) ───
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch {
      payload = {};
    }
  }
  const title = payload.title || 'UZEED';
  const options = {
    body: payload.body || 'Tienes una nueva notificación',
    icon: '/brand/isotipo-new.png',
    badge: '/brand/isotipo-new.png',
    data: payload.data || {},
    tag: payload.tag || 'uzeed-notification',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname === targetPath) {
              client.focus();
              return;
            }
          } catch {}
        }
        if (clientsArr.length > 0) {
          clientsArr[0].focus();
          clientsArr[0].navigate(targetPath);
          return;
        }
        self.clients.openWindow(targetPath);
      })
  );
});
