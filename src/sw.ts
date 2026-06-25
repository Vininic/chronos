import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

clientsClaim();
precacheAndRoute(self["__WB_MANIFEST"]);

self.addEventListener("push", (event) => {
  const e = event as any;
  const data = e.data?.json() ?? { title: "Chronos", body: "" };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-192x192.svg",
      badge: "/pwa-192x192.svg",
      vibrate: [200, 100, 200],
      data: data.data,
    } as any)
  );
});

self.addEventListener("notificationclick", (event) => {
  const e = event as any;
  e.notification.close();
  const urlToOpen = e.notification.data?.url ?? "/dashboard";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const clients = windowClients as any[];
      for (const client of clients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
