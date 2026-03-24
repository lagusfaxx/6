// Version-based cache for automatic invalidation on deployment
const CACHE_VERSION = 'v1-' + new Date().toISOString().slice(0,10);
const CACHE_NAME = `uzeed-cache-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Delete old caches on install
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('uzeed-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // Safari/iOS can be strict about push handling. We always show a visible
  // notification and make payload parsing resilient.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch {
      payload = {};
    }
  }
  const title = payload.title || "UZEED";
  const options = {
    body: payload.body || "Tienes una nueva notificación",
    icon: "/brand/isotipo-new.png",
    badge: "/brand/isotipo-new.png",
    data: payload.data || {},
    tag: payload.tag || "uzeed-notification"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        // Try to find an existing window and navigate it
        for (const client of clientsArr) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname === targetPath) {
              client.focus();
              return;
            }
          } catch {}
        }
        // If we have any open window, navigate it instead of opening a new one
        if (clientsArr.length > 0) {
          clientsArr[0].focus();
          clientsArr[0].navigate(targetPath);
          return;
        }
        // No windows open — open a new one
        self.clients.openWindow(targetPath);
      })
  );
});
