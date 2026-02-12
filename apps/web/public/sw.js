self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
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
  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const hadWindowToFocus = clientsArr.some((windowClient) => {
          if (windowClient.url === targetUrl) {
            windowClient.focus();
            return true;
          }
          return false;
        });

        if (!hadWindowToFocus) {
          self.clients.openWindow(targetUrl);
        }
      })
  );
});
