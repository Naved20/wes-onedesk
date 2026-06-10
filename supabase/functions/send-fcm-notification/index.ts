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
const firebaseApiKey = Deno.env.get("FIREBASE_API_KEY");
const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationRequest {
  userId: string;
  title: string;
  message: string;
  type: "salary" | "leave" | "attendance" | "task" | "general";
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
      .eq("is_active", true)
      .single();

    if (tokenError || !tokenData) {
      console.log("No active FCM token found for user:", payload.userId);
      return new Response(
        JSON.stringify({ message: "No device registered for notifications" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // If Firebase not configured, just return success
    if (!firebaseProjectId || !firebaseApiKey) {
      console.log("Firebase not configured. Skipping FCM notification.");
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
 * Get Firebase access token
 * In production, use service account credentials
 */
async function getFirebaseAccessToken(): Promise<string | null> {
  try {
    // This is a simplified version. In production, you would:
    // 1. Use Firebase Admin SDK with service account credentials
    // 2. Or use a service account key file
    // For now, we'll use the API key approach which has limitations
    
    // Note: FCM v1 API requires OAuth2 token from service account
    // You need to set up a service account and generate the token
    // This is a placeholder implementation
    
    // In production, use something like:
    // const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT"));
    // const token = await getServiceAccountToken(serviceAccount);
    
    return firebaseApiKey; // This won't work for FCM v1 API, needs proper token
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
