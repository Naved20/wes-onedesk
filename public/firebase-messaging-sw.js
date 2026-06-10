/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications
 */

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging.js');

// Initialize Firebase (will be configured from main app)
firebase.initializeApp({
  // Config will be injected by the main app
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  apiKey: "YOUR_API_KEY",
});

// Handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.id || 'notification',
    data: payload.data || {},
    requireInteraction: false,
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);

  // Handle notification click
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const notificationType = event.notification.data?.type;
    let urlToOpen = '/';

    // Determine URL based on notification type
    switch (notificationType) {
      case 'salary':
        urlToOpen = '/salary';
        break;
      case 'leave':
        urlToOpen = '/leaves';
        break;
      case 'attendance':
        urlToOpen = '/attendance';
        break;
      case 'task':
        urlToOpen = '/tasks';
        break;
      default:
        urlToOpen = '/';
    }

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Check if there's already a window open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  });
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
