import { supabase } from "@/integrations/supabase/client";

interface DeviceInfo {
  browser_name: string;
  os_name: string;
  device_type: string;
  user_agent: string;
}

interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

// Generate a unique session token
export const generateSessionToken = (): string => {
  return `face_session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Get device information from user agent
export const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  // Detect OS
  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  // Detect device type
  let deviceType = "Desktop";
  if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) deviceType = "Mobile";
  else if (/Tablet|iPad/.test(ua)) deviceType = "Tablet";

  return {
    browser_name: browser,
    os_name: os,
    device_type: deviceType,
    user_agent: ua,
  };
};

// Get user's geolocation
export const getLocation = (): Promise<LocationInfo | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locationInfo: LocationInfo = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        // Try to get human-readable address using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationInfo.latitude}&lon=${locationInfo.longitude}`
          );
          const data = await response.json();
          if (data.display_name) {
            locationInfo.address = data.display_name;
          }
        } catch (error) {
          console.error("Failed to get address:", error);
        }

        resolve(locationInfo);
      },
      (error) => {
        console.error("Geolocation error:", error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};
// Get IP address (using a public API)
export const getIPAddress = async (): Promise<string> => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip || "Unknown";
  } catch (error) {
    console.error("Failed to get IP address:", error);
    return "Unknown";
  }
};

// Create a new session
export const createFaceSession = async (): Promise<string> => {
  const sessionToken = generateSessionToken();
  const deviceInfo = getDeviceInfo();
  
  try {
    const ipAddress = await getIPAddress();
    const locationInfo = await getLocation();

    const { error } = await (supabase as any).from("face_attendance_sessions").insert({
      session_token: sessionToken,
      device_info: deviceInfo,
      ip_address: ipAddress,
      user_agent: deviceInfo.user_agent,
      browser_name: deviceInfo.browser_name,
      os_name: deviceInfo.os_name,
      device_type: deviceInfo.device_type,
      latitude: locationInfo?.latitude,
      longitude: locationInfo?.longitude,
      location_accuracy: locationInfo?.accuracy,
      location_address: locationInfo?.address,
      is_active: true,
    });

    if (error) {
      console.error("Failed to create session:", error);
      // Don't throw error, just log it - allow login to proceed
    }

    return sessionToken;
  } catch (error) {
    console.error("Error creating face session:", error);
    // Return token anyway to allow login
    return sessionToken;
  }
};

// Update session activity
export const updateSessionActivity = async (sessionToken: string): Promise<void> => {
  try {
    await supabase
      .from("face_attendance_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("session_token", sessionToken)
      .eq("is_active", true);
  } catch (error) {
    console.error("Error updating session activity:", error);
  }
};

// Logout session
export const logoutFaceSession = async (
  sessionToken: string,
  reason: string = "User logout"
): Promise<void> => {
  try {
    await supabase
      .from("face_attendance_sessions")
      .update({
        is_active: false,
        logout_time: new Date().toISOString(),
        logout_reason: reason,
      })
      .eq("session_token", sessionToken);
  } catch (error) {
    console.error("Error logging out session:", error);
  }
};

// Check if session is valid
export const isSessionValid = async (sessionToken: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("face_attendance_sessions")
      .select("is_active")
      .eq("session_token", sessionToken)
      .single();

    if (error || !data) return false;
    return data.is_active;
  } catch (error) {
    console.error("Error checking session validity:", error);
    return false;
  }
};

// Admin: Get all active sessions
export const getAllActiveSessions = async () => {
  try {
    const { data, error } = await supabase
      .from("face_attendance_sessions")
      .select("*")
      .eq("is_active", true)
      .order("login_time", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    return [];
  }
};

// Admin: Get all sessions (active and inactive)
export const getAllSessions = async () => {
  try {
    const { data, error } = await supabase
      .from("face_attendance_sessions")
      .select("*")
      .order("login_time", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching all sessions:", error);
    return [];
  }
};

// Admin: Force logout a session
export const adminLogoutSession = async (sessionToken: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("face_attendance_sessions")
      .update({
        is_active: false,
        logout_time: new Date().toISOString(),
        logout_reason: "Admin forced logout",
      })
      .eq("session_token", sessionToken);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error forcing logout:", error);
    return false;
  }
};
