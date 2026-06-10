/**
 * Service Worker for handling notifications
 * Handles background notifications and notification clicks
 */

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  const data = event.data?.json?.() || {};
  const title = data.notification?.title || "Notification";
  const options = {
    body: data.notification?.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.data?.id || "notification",
    data: data.data || {},
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event.notification);
  event.notification.close();

  const urlToOpen = "/";
  
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});
