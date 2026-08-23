import { supabase } from "@/integrations/supabase/client";
import { playBeep, playSuccessBeep, playWarningBeep, playErrorBeep } from "@/lib/audioFeedback";

export interface GeoFenceSettings {
  is_enabled: boolean;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address?: string;
  updated_at?: string;
}

const DEFAULT_GEOFENCE: GeoFenceSettings = {
  is_enabled: false,
  latitude: 28.6139, // Default center (e.g. Delhi / institution default)
  longitude: 77.2090,
  radius_meters: 200,
  address: "Default Geofence Location",
};

const STORAGE_KEY = "face_hub_geofence_config";

/**
 * Calculate distance between two coordinates in meters using the Haversine formula
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
};

/**
 * Sound effects helper for Geo-Fence interactions
 */
export const playGeoBeep = {
  toggleOn: () => {
    try {
      playBeep(650, 0.12, 0.3);
    } catch (e) {
      console.warn("Audio error", e);
    }
  },
  toggleOff: () => {
    try {
      playBeep(350, 0.15, 0.3);
    } catch (e) {
      console.warn("Audio error", e);
    }
  },
  selectMapLocation: () => {
    try {
      playBeep(800, 0.08, 0.25);
    } catch (e) {
      console.warn("Audio error", e);
    }
  },
  saveSettings: () => {
    try {
      playSuccessBeep();
    } catch (e) {
      console.warn("Audio error", e);
    }
  },
  errorBlocked: () => {
    try {
      playErrorBeep();
    } catch (e) {
      console.warn("Audio error", e);
    }
  }
};

/**
 * Fetch current Geo-Fence settings from database (with local fallback & sync)
 */
export const getGeoFenceSettings = async (): Promise<GeoFenceSettings> => {
  try {
    // Attempt to fetch from Supabase table face_hub_otp or face_attendance_sessions system config if table exists
    const { data, error } = await (supabase as any)
      .from("face_hub_geofence" as any)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const config = data[0];
      const settings: GeoFenceSettings = {
        is_enabled: Boolean(config.is_enabled),
        latitude: Number(config.latitude),
        longitude: Number(config.longitude),
        radius_meters: Number(config.radius_meters) || 200,
        address: config.address || "",
        updated_at: config.updated_at,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return settings;
    }
  } catch (err) {
    console.warn("[geoFenceManager] Database fetch warning, using stored local settings:", err);
  }

  // Fallback to localStorage or default settings
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("[geoFenceManager] Local parse error", e);
    }
  }

  return DEFAULT_GEOFENCE;
};

/**
 * Save Geo-Fence settings to database & local storage
 */
export const saveGeoFenceSettings = async (
  settings: GeoFenceSettings
): Promise<boolean> => {
  const updatedSettings: GeoFenceSettings = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  // Always save locally first for instant access
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));

  try {
    // Attempt DB upsert/insert
    const { error } = await (supabase as any)
      .from("face_hub_geofence" as any)
      .upsert({
        id: "default_geofence",
        is_enabled: updatedSettings.is_enabled,
        latitude: updatedSettings.latitude,
        longitude: updatedSettings.longitude,
        radius_meters: updatedSettings.radius_meters,
        address: updatedSettings.address || null,
        updated_at: updatedSettings.updated_at,
      });

    if (error) {
      console.warn("[geoFenceManager] DB save error (will rely on synced local state):", error.message);
    }
  } catch (err) {
    console.warn("[geoFenceManager] DB exception during save:", err);
  }

  // Play save beep sound
  playGeoBeep.saveSettings();
  return true;
};

/**
 * Validate user location against active Geo-Fence
 */
export const validateUserGeoFence = async (
  userLat: number,
  userLng: number
): Promise<{ allowed: boolean; distance: number; radius: number; message: string }> => {
  const settings = await getGeoFenceSettings();

  if (!settings.is_enabled) {
    return {
      allowed: true,
      distance: 0,
      radius: settings.radius_meters || 200,
      message: "Geo-fencing is disabled.",
    };
  }

  const distance = calculateHaversineDistance(
    userLat,
    userLng,
    settings.latitude,
    settings.longitude
  );

  const radius = settings.radius_meters || 200;

  if (distance <= radius) {
    return {
      allowed: true,
      distance,
      radius,
      message: `Location verified! You are within the allowed area (${distance}m / ${radius}m).`,
    };
  }

  playGeoBeep.errorBlocked();

  return {
    allowed: false,
    distance,
    radius,
    message: `Access Blocked: You are outside the allowed Geo-Fence area! Your distance is ${distance} meters, but maximum allowed is ${radius} meters.`,
  };
};
