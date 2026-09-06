import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATCH_THRESHOLD = 0.30; // Stricter threshold - distance must be below 0.30 for match
const CONFIDENCE_GAP = 0.20; // Second-best match must be at least 0.20 worse than best match

type Descriptor = number[];

interface FaceDescriptorRow {
  user_id: string;
  descriptor: unknown;
}

function normalizeDescriptor(value: unknown): Descriptor | null {
  if (!Array.isArray(value)) return null;
  const numbers = value.map((v) => Number(v));
  return numbers.length > 0 && numbers.every(Number.isFinite) ? numbers : null;
}

function euclideanDistance(a: Descriptor, b: Descriptor): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: "Face attendance backend is not configured." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));

    if (body.action === "history") {
      const { data, error } = await supabaseAdmin
        .from("face_checkin_history")
        .select("id, user_id, matched, match_distance, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map((row) => row.user_id).filter(Boolean))) as string[];
      const nameMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);

        if (profileError) throw profileError;
        profiles?.forEach((profile) => {
          nameMap.set(profile.user_id, `${profile.first_name} ${profile.last_name}`);
        });
      }

      return json({
        ok: true,
        history: (data ?? []).map((row) => ({
          ...row,
          employee_name: row.user_id ? nameMap.get(row.user_id) : undefined,
        })),
      });
    }

    const candidate = normalizeDescriptor(body.descriptor);
    if (!candidate) {
      return json({ ok: false, message: "Face scan data is invalid. Please scan again." }, 400);
    }

    const { data: enrolled, error: enrolledError } = await supabaseAdmin
      .from("face_descriptors")
      .select("user_id, descriptor")
      .eq("is_active", true);

    if (enrolledError) throw enrolledError;

    const validEnrollments = ((enrolled ?? []) as FaceDescriptorRow[])
      .map((row) => ({ user_id: row.user_id, descriptor: normalizeDescriptor(row.descriptor) }))
      .filter((row): row is { user_id: string; descriptor: Descriptor } => Boolean(row.descriptor));

    if (validEnrollments.length === 0) {
      return json({ ok: false, message: "No enrolled faces in system.", enrolledCount: 0 });
    }

    let bestMatch: { user_id: string; distance: number } | null = null;

    for (const enrollment of validEnrollments) {
      const distance = euclideanDistance(candidate, enrollment.descriptor);
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { user_id: enrollment.user_id, distance };
      }
    }

    if (!bestMatch) {
      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: null,
        matched: false,
        match_distance: null,
        notes: "No enrolled faces to compare",
      });

      return json({
        ok: false,
        message: "Face not recognized.",
        distance: null,
        enrolledCount: validEnrollments.length,
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("employee_profiles")
      .select("first_name, last_name")
      .eq("user_id", bestMatch.user_id)
      .maybeSingle();

    const employeeName = profile ? `${profile.first_name} ${profile.last_name}` : "Employee";
    const today = todayInIndia();

    const { data: shiftRows } = await supabaseAdmin.rpc("get_employee_shift", {
      p_user_id: bestMatch.user_id,
      p_date: today,
    });
    const shiftId = shiftRows?.[0]?.shift_id ?? null;
    const shiftName = shiftRows?.[0]?.shift_name ?? null;
    const shiftStartTime = shiftRows?.[0]?.start_time ?? null;
    const shiftEndTime = shiftRows?.[0]?.end_time ?? null;

    const mode = body.mode || "auto"; // "auto" | "checkin" | "checkout"

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("attendance")
      .select("id, check_in_time, check_out_time, notes")
      .eq("user_id", bestMatch.user_id)
      .eq("date", today)
      .maybeSingle();

    if (existingError) throw existingError;

    // Fetch shift checkout rules if shiftId exists
    let shiftRules: any = null;
    if (shiftId) {
      const { data: sData } = await supabaseAdmin
        .from("shifts")
        .select("is_checkout_mandatory, early_checkout_threshold_minutes, max_checkout_hours_after_end, min_hours_full_day, missing_checkout_action")
        .eq("id", shiftId)
        .maybeSingle();
      shiftRules = sData;
    }

    let sessionDetails = "";
    if (body.session_token) {
      const { data: sessData } = await supabaseAdmin
        .from("face_attendance_sessions")
        .select("os_name, browser_name, location_address, ip_address")
        .eq("session_token", body.session_token)
        .maybeSingle();

      if (sessData) {
        const deviceStr = [sessData.os_name, sessData.browser_name].filter(Boolean).join(" - ");
        const ipStr = sessData.ip_address ? ` [IP: ${sessData.ip_address}]` : "";
        const locStr = sessData.location_address ? ` (${sessData.location_address})` : "";
        sessionDetails = deviceStr ? ` | ${deviceStr}${ipStr}${locStr}` : "";
      }
    }

    // CASE 1: Employee explicitly chose "checkout" but has NOT checked in today
    if (mode === "checkout" && !existing?.check_in_time) {
      const notInMsg = `${employeeName}, you are not checked in today! Please check in first.`;
      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: bestMatch.user_id,
        matched: true,
        match_distance: bestMatch.distance,
        attendance_id: existing?.id ?? null,
        notes: `Failed Check-out Attempt (Not Checked In) - Matched ${employeeName}${sessionDetails}`,
      });

      return json({
        ok: false,
        notCheckedIn: true,
        action: "not_checked_in",
        employeeName,
        message: notInMsg,
        distance: bestMatch.distance,
        shiftName,
        shiftStartTime,
        shiftEndTime,
      });
    }

    // CASE 2: Employee already checked out today
    if (existing?.check_out_time && (mode === "checkout" || mode === "auto")) {
      const dt = new Date(existing.check_out_time);
      const formattedCheckOutTime = dt.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const alreadyOutMsg = `${employeeName} already checked out today at ${formattedCheckOutTime}.`;

      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: bestMatch.user_id,
        matched: true,
        match_distance: bestMatch.distance,
        attendance_id: existing.id,
        notes: `Duplicate Scan (Already checked out) - Matched ${employeeName}${sessionDetails}`,
      });

      return json({
        ok: true,
        alreadyCheckedOut: true,
        action: "already_checked_out",
        employeeName,
        formattedCheckOutTime,
        message: alreadyOutMsg,
        distance: bestMatch.distance,
        enrolledCount: validEnrollments.length,
        attendanceId: existing.id,
        shiftName,
        shiftStartTime,
        shiftEndTime,
      });
    }

    // CASE 3: Perform Check-out
    // Allowed if mode is "checkout" OR (mode is "auto" and employee checked in at least 2 minutes ago)
    const checkInMs = existing?.check_in_time ? new Date(existing.check_in_time).getTime() : 0;
    const diffMs = checkInMs > 0 ? Date.now() - checkInMs : 0;
    const isAutoCheckoutReady = mode === "auto" && existing?.check_in_time && diffMs >= 2 * 60 * 1000;
    const isExplicitCheckout = mode === "checkout" && existing?.check_in_time;

    if (isExplicitCheckout || isAutoCheckoutReady) {
      const now = new Date();
      const totalMins = Math.max(0, Math.floor(diffMs / (60 * 1000)));
      const durationHours = Math.floor(totalMins / 60);
      const durationMinutes = totalMins % 60;
      const durationStr = `${durationHours}h ${durationMinutes}m`;

      const formattedCheckOutTime = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Check Early Checkout Rule
      let isEarly = false;
      let isLateCheckout = false;
      if (shiftEndTime) {
        try {
          const [shHours, shMins] = shiftEndTime.split(":").map(Number);
          const istNowStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(now);
          const [currHours, currMins] = istNowStr.split(":").map(Number);
          const currTotalMins = currHours * 60 + currMins;
          const shiftEndTotalMins = shHours * 60 + shMins;
          const earlyThreshold = shiftRules?.early_checkout_threshold_minutes ?? 15;

          if (currTotalMins < shiftEndTotalMins - earlyThreshold) {
            isEarly = true;
          }

          const maxLateHours = shiftRules?.max_checkout_hours_after_end ?? 2.0;
          if (currTotalMins > shiftEndTotalMins + (maxLateHours * 60)) {
            isLateCheckout = true;
          }
        } catch (e) {
          console.error("Shift checkout time calculation error:", e);
        }
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("attendance")
        .update({
          check_out_time: now.toISOString(),
          notes: ((existing?.notes ?? "") ? `${existing.notes} | ` : "") + "Face recognition check-out",
        })
        .eq("id", existing!.id)
        .select("id")
        .single();

      if (updateError) throw updateError;
      const attendanceId = updated?.id ?? existing!.id;

      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: bestMatch.user_id,
        matched: true,
        match_distance: bestMatch.distance,
        attendance_id: attendanceId,
        notes: `Check-out - Matched ${employeeName} (Duration: ${durationStr})${isEarly ? " [Early Departure]" : ""}${sessionDetails}`,
      });

      return json({
        ok: true,
        action: "checkout",
        employeeName,
        formattedCheckOutTime,
        durationHours,
        durationMinutes,
        durationStr,
        isEarly,
        isLateCheckout,
        message: `Goodbye, ${employeeName}! Check-out recorded. Total working time: ${durationStr}`,
        distance: bestMatch.distance,
        enrolledCount: validEnrollments.length,
        attendanceId,
        shiftName,
        shiftStartTime,
        shiftEndTime,
      });
    }

    // CASE 4: Already Checked In (Duplicate scan in check-in mode or within 2 mins of auto check-in)
    if (existing?.check_in_time) {
      const dt = new Date(existing.check_in_time);
      const formattedCheckInTime = dt.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const alreadyInMsg = `${employeeName} already checked in today at ${formattedCheckInTime}.`;

      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: bestMatch.user_id,
        matched: true,
        match_distance: bestMatch.distance,
        attendance_id: existing.id,
        notes: `Duplicate Scan (Already checked in) - Matched ${employeeName}${sessionDetails}`,
      });

      return json({
        ok: true,
        alreadyCheckedIn: true,
        action: "already_checked_in",
        formattedCheckInTime,
        message: alreadyInMsg,
        distance: bestMatch.distance,
        enrolledCount: validEnrollments.length,
        employeeName,
        attendanceId: existing.id,
        shiftName,
        shiftStartTime,
        shiftEndTime,
      });
    }

    // CASE 5: Normal Check-in (First scan of the day)
    let attendanceId: string | null = null;
    if (existing) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("attendance")
        .update({
          check_in_time: new Date().toISOString(),
          status: "approved",
          shift_id: shiftId,
          notes: "Face recognition check-in",
        })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (updateError) throw updateError;
      attendanceId = updated?.id ?? null;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("attendance")
        .insert({
          user_id: bestMatch.user_id,
          date: today,
          check_in_time: new Date().toISOString(),
          status: "approved",
          shift_id: shiftId,
          notes: "Face recognition check-in",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      attendanceId = inserted?.id ?? null;
    }

    await supabaseAdmin.from("face_checkin_history").insert({
      user_id: bestMatch.user_id,
      matched: true,
      match_distance: bestMatch.distance,
      attendance_id: attendanceId,
      notes: `Check-in - Matched ${employeeName}${sessionDetails}`,
    });

    return json({
      ok: true,
      action: "checkin",
      alreadyCheckedIn: false,
      message: `Welcome, ${employeeName}! Check-in recorded.`,
      distance: bestMatch.distance,
      enrolledCount: validEnrollments.length,
      employeeName,
      attendanceId,
      shiftName,
      shiftStartTime,
      shiftEndTime,
    });
  } catch (error) {
    console.error("Face hub check-in error:", error);
    const message = error instanceof Error ? error.message : "Face check-in failed.";
    return json({ ok: false, message }, 500);
  }
});