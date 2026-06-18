/**
 * Supabase Edge Function: Send FCM Notification
 * Sends push notifications to mobile devices via Firebase Cloud Messaging
 * 
 * Call with POST request:
 * {
 *   "userId": "user-id",
 *   "title": "Notification Title",
 *   "message": "Notification Message",
 *   "type": "salary|leave|attendance|task",
 *   "relatedId": "optional-related-id"
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const firebaseProjectId = Deno.env.get("VITE_APP_FIREBASE_PROJECT_ID") || Deno.env.get("FIREBASE_PROJECT_ID");
const firebaseServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:8080",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

interface NotificationRequest {
  userId: string;
  title: string;
  message: string;
  type: "salary" | "leave" | "attendance" | "task" | "general" | "announcement";
  relatedId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: NotificationRequest = await req.json();

    // Validate input
    if (!payload.userId || !payload.title || !payload.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user's FCM token from database
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_fcm_tokens")
      .select("fcm_token")
      .eq("user_id", payload.userId)
      .maybeSingle();

    if (tokenError || !tokenData?.fcm_token) {
      console.log("No FCM token found for user:", payload.userId);
      return new Response(
        JSON.stringify({ message: "No device registered for notifications" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // If Firebase not configured, just return success
    if (!firebaseProjectId) {
      console.log("Firebase project ID not configured. Skipping FCM notification.");
      return new Response(
        JSON.stringify({ message: "Firebase not configured" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Send FCM notification
    const fcmResponse = await sendFCMNotification(
      tokenData.fcm_token,
      payload
    );

    if (!fcmResponse.success) {
      console.error("Failed to send FCM notification:", fcmResponse.error);
      return new Response(
        JSON.stringify({ error: fcmResponse.error }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in send-fcm-notification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Send FCM notification via Firebase API
 */
async function sendFCMNotification(
  fcmToken: string,
  payload: NotificationRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;

    // Prepare FCM message
    const message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.message,
      },
      data: {
        type: payload.type,
        relatedId: payload.relatedId || "",
        clickAction: getClickAction(payload.type),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "default",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
    };

    // Get access token for Firebase API
    const accessToken = await getFirebaseAccessToken();
    if (!accessToken) {
      return { success: false, error: "Could not get Firebase access token" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("FCM API error:", error);
      return { success: false, error: `FCM API error: ${response.status}` };
    }

    const result = await response.json();
    console.log("FCM notification sent successfully:", result);
    return { success: true };
  } catch (error) {
    console.error("Error sending FCM notification:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get Firebase access token using service account credentials
 */
async function getFirebaseAccessToken(): Promise<string | null> {
  try {
    if (!firebaseServiceAccount) {
      console.warn("Firebase service account not configured");
      return null;
    }

    const serviceAccount = JSON.parse(firebaseServiceAccount);
    
    // Create JWT token for service account
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Import crypto module for JWT signing
    const encoder = new TextEncoder();
    const headerEncoded = btoa(JSON.stringify(header));
    const payloadEncoded = btoa(JSON.stringify(payload));

    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const signatureInputBytes = encoder.encode(signatureInput);

    // Sign with private key
    const privateKey = serviceAccount.private_key;
    const key = await crypto.subtle.importKey(
      "pkcs8",
      new TextEncoder().encode(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureInputBytes
    );

    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = `${signatureInput}.${signatureEncoded}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      console.error("Failed to get access token:", tokenData.error);
      return null;
    }

    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting Firebase access token:", error);
    return null;
  }
}

/**
 * Get click action URL based on notification type
 */
function getClickAction(type: string): string {
  switch (type) {
    case "salary":
      return "salary_notification";
    case "leave":
      return "leave_notification";
    case "attendance":
      return "attendance_notification";
    case "task":
      return "task_notification";
    default:
      return "default_notification";
  }
}
