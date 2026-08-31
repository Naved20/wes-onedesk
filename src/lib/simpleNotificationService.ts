/**
 * Simple Web Notification Service
 * Uses native browser notifications without Firebase FCM
 * Works on mobile browsers and PWAs
 */

import { supabase } from "@/integrations/supabase/client";

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Browser doesn't support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.log("Service Workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { scope: "/" }
    );
    console.log("Service Worker registered:", registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export async function sendBrowserNotification(
  title: string,
  options?: NotificationOptions
) {
  if (Notification.permission !== "granted") {
    console.log("Notification permission not granted");
    return;
  }

  try {
    // If service worker is active, use it
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        requireInteraction: false,
        ...options,
      });
    } else {
      // Fallback to simple notification
      new Notification(title, {
        icon: "/favicon.ico",
        ...options,
      });
    }
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

/**
 * Listen for real-time notifications and show browser notifications
 */
export function setupRealtimeNotifications(userId: string) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  stopRealtimeNotifications(userId);

  const topicName = `notifications:${userId}`;
  const channel = supabase.channel(topicName);

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const notification = payload.new as any;
      
      // Show browser notification
      sendBrowserNotification(notification.title, {
        body: notification.message,
        tag: notification.id,
        data: {
          id: notification.id,
          type: notification.type,
          relatedId: notification.related_id,
        },
      });

      console.log("New notification received:", notification);
    }
  );

  channel.subscribe((status, err) => {
    if (err) {
      console.error("Realtime notification subscription status error:", err);
    } else {
      console.log("Realtime notification subscription status:", status);
    }
  });

  return channel;
}

/**
 * Stop listening for real-time notifications
 */
export async function stopRealtimeNotifications(userId: string) {
  try {
    const topicName = `notifications:${userId}`;
    const existing = supabase.getChannels().find(
      (ch) => ch.topic === `realtime:${topicName}` || ch.topic === topicName
    );
    if (existing) {
      await supabase.removeChannel(existing);
    }
  } catch (error) {
    console.error("Error removing notification channel:", error);
  }
}
