import { supabase } from "@/integrations/supabase/client";

export interface FaceOtpInfo {
  code: string;
  secondsRemaining: number;
  expiresAt: string;
}

const generateRandom6DigitCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Get current active 60-second OTP for Face Hub (returns null if no active OTP)
 */
export const getCurrentFaceOtp = async (autoCreate: boolean = false): Promise<FaceOtpInfo | null> => {
  try {
    const nowIso = new Date().toISOString();
    
    // Fetch latest unused and non-expired OTP
    const { data, error } = await supabase
      .from("face_hub_otp" as any)
      .select("*")
      .eq("is_used", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const activeOtp = data[0];
      const expiresAtMs = new Date(activeOtp.expires_at).getTime();
      const secondsRemaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

      if (secondsRemaining > 0) {
        return {
          code: activeOtp.otp_code,
          secondsRemaining,
          expiresAt: activeOtp.expires_at,
        };
      }
    }

    if (autoCreate) {
      return await generateNewFaceOtp();
    }

    return null;
  } catch (err) {
    console.error("[faceOtpManager] Error fetching current OTP:", err);
    if (autoCreate) {
      return await generateNewFaceOtp();
    }
    return null;
  }
};

/**
 * Force-generate a brand new 60-second OTP (called when login starts or Admin clicks Regenerate)
 */
export const generateNewFaceOtp = async (): Promise<FaceOtpInfo> => {
  try {
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 1000).toISOString();
    const newCode = generateRandom6DigitCode();

    // Mark previous active OTPs as used
    await supabase
      .from("face_hub_otp" as any)
      .update({ is_used: true })
      .eq("is_used", false);

    // Insert new OTP
    const { data, error } = await supabase
      .from("face_hub_otp" as any)
      .insert({
        otp_code: newCode,
        expires_at: expiresAt,
        is_used: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[faceOtpManager] Error inserting new OTP:", error);
    }

    return {
      code: data?.otp_code || newCode,
      secondsRemaining: 60,
      expiresAt: data?.expires_at || expiresAt,
    };
  } catch (err) {
    console.error("[faceOtpManager] Error generating new OTP:", err);
    const newCode = generateRandom6DigitCode();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    return {
      code: newCode,
      secondsRemaining: 60,
      expiresAt,
    };
  }
};

/**
 * Verify if the entered 6-digit OTP is valid and active
 */
export const verifyFaceOtp = async (inputOtp: string): Promise<{ valid: boolean; message: string }> => {
  try {
    const cleanOtp = inputOtp.trim().replace(/\s+/g, "");
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return { valid: false, message: "Please enter a valid 6-digit OTP code." };
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("face_hub_otp" as any)
      .select("*")
      .eq("otp_code", cleanOtp)
      .eq("is_used", false)
      .gt("expires_at", nowIso)
      .limit(1);

    if (error) {
      console.error("[faceOtpManager] Error verifying OTP:", error);
      return { valid: false, message: "Failed to verify OTP with server. Please try again." };
    }

    if (!data || data.length === 0) {
      return {
        valid: false,
        message: "Invalid or Expired OTP! Please ask Administrator to generate a new 60-second OTP.",
      };
    }

    // Mark OTP as used so it cannot be reused
    await supabase
      .from("face_hub_otp" as any)
      .update({ is_used: true })
      .eq("id", data[0].id);

    return { valid: true, message: "OTP verified successfully!" };
  } catch (err) {
    console.error("[faceOtpManager] OTP verification exception:", err);
    return { valid: false, message: "Verification error occurred. Please try again." };
  }
};
