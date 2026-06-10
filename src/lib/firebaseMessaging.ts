/**
 * Firebase Cloud Messaging Service
 * Handles mobile push notifications
 */

import { firebaseConfig, FIREBASE_SENDER_ID } from "./firebaseConfig";
import { playNotificationSound } from "./audioNotification";
import { supabase } from "@/integrations/supabase/client";

// Lazy load Firebase modules
let firebaseModules: any = null;

async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;

  try {
    const firebase = await import("firebase/app");
    const messaging = await import("firebase/messaging");
    firebaseModules = {
      initializeApp: firebase.initializeApp,
      getMessaging: messaging.getMessaging,
      getToken: messaging.getToken,
      onMessage: messaging.onMessage,
    };
    return firebaseModules;
  } catch (error) {
    console.debug("Firebase not available - push notifications disabled", error);
    return null;
  }
}

let messaging: any = null;
let initialized = false;

/**
 * Initialize Firebase and messaging
 */
export async function initializeFirebaseMessaging() {
  if (initialized) return;

  try {
    // Load Firebase modules
    const modules = await loadFirebaseModules();
    
    // Check if Firebase is available
    if (!modules) {
      console.debug("Firebase SDK not available. Push notifications disabled.");
      return;
    }

    const { initializeApp, getMessaging, getToken, onMessage } = modules;

    // Check if Firebase config is complete
    if (!firebaseConfig.projectId || !FIREBASE_SENDER_ID) {
      console.warn("Firebase config not complete. Push notifications disabled.");
      return;
    }

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const msg = getMessaging(app);
    messaging = msg;
    initialized = true;

    // Request notification permission
    if ("serviceWorker" in navigator && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("Notification permission granted");
        
        // Get FCM token
        const token = await getToken(msg, {
          vapidKey: FIREBASE_SENDER_ID,
        });

        if (token) {
          await saveTokenToDatabase(token);
          console.log("FCM Token saved:", token);
        }
      }
    }

    // Handle foreground messages
    if (msg && onMessage) {
      onMessage(msg, (payload: MessagePayload) => {
        handleForegroundMessage(payload);
      });
    }

    console.log("Firebase Messaging initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase Messaging:", error);
  }
}

/**
 * Save FCM token to database
 */
async function saveTokenToDatabase(token: string) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) return;

    // Save token to a new table or update user profile
    // You may need to create a table for FCM tokens
    const { error } = await supabase
      .from("user_fcm_tokens")
      .upsert({
        user_id: user.user.id,
        fcm_token: token,
        device_type: getDeviceType(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (error) {
      console.error("Error saving FCM token:", error);
    }
  } catch (error) {
    console.error("Error in saveTokenToDatabase:", error);
  }
}

/**
 * Handle foreground messages
 */
function handleForegroundMessage(payload: MessagePayload) {
  console.log("Received foreground message:", payload);

  const { notification, data } = payload;

  if (notification) {
    // Play notification sound
    playNotificationSound(notification.title || "notification");

    // Show browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notification.title || "Notification", {
        body: notification.body,
        icon: notification.icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: data?.id || "notification",
      });
    }

    // Additional handling based on notification type
    if (data?.type) {
      handleNotificationByType(data.type, data, notification);
    }
  }
}

/**
 * Handle specific notification types
 */
function handleNotificationByType(
  type: string,
  data: Record<string, string>,
  notification: any
) {
  switch (type) {
    case "salary":
      console.log("Salary notification:", data);
      // Reload salary data or navigate to salary page
      window.dispatchEvent(new CustomEvent("salaryNotificationReceived", { detail: data }));
      break;

    case "leave":
      console.log("Leave notification:", data);
      window.dispatchEvent(new CustomEvent("leaveNotificationReceived", { detail: data }));
      break;

    case "attendance":
      console.log("Attendance notification:", data);
      window.dispatchEvent(new CustomEvent("attendanceNotificationReceived", { detail: data }));
      break;

    case "task":
      console.log("Task notification:", data);
      window.dispatchEvent(new CustomEvent("taskNotificationReceived", { detail: data }));
      break;

    default:
      console.log("General notification:", data);
  }
}

/**
 * Get device type
 */
function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

/**
 * Send notification to user's mobile device
 * Note: This should be called from your backend (Cloud Function)
 */
export async function sendMobileNotification(
  userId: string,
  title: string,
  message: string,
  type: "salary" | "leave" | "attendance" | "task" | "general",
  data?: Record<string, string>
) {
  try {
    // This function would typically call a backend Cloud Function
    // that sends the actual FCM message
    // For now, we'll just log it
    console.log("Mobile notification to send:", {
      userId,
      title,
      message,
      type,
      data,
    });

    // You would call something like:
    // const response = await functions.httpsCallable('sendNotification')({
    //   userId,
    //   title,
    //   message,
    //   type,
    //   data
    // });
  } catch (error) {
    console.error("Error sending mobile notification:", error);
  }
}

type MessagePayload = {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
  };
  data?: Record<string, string>;
};

/**
 * Request notification token
 */
export async function requestNotificationToken(): Promise<string | null> {
  try {
    const modules = await loadFirebaseModules();
    
    if (!modules || !messaging) {
      console.warn("Firebase Messaging not initialized");
      return null;
    }

    const { getToken } = modules;
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_SENDER_ID,
    });

    if (token) {
      await saveTokenToDatabase(token);
      return token;
    }

    return null;
  } catch (error) {
    console.error("Error requesting notification token:", error);
    return null;
  }
}

/**
 * Check if notifications are supported and enabled
 */
export function areNotificationsSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "messaging" in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if ("Notification" in window) {
    return Notification.permission;
  }
  return "denied";
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}
