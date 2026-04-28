import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATCH_THRESHOLD = 0.68;

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

    if (!bestMatch || bestMatch.distance > MATCH_THRESHOLD) {
      await supabaseAdmin.from("face_checkin_history").insert({
        user_id: null,
        matched: false,
        match_distance: bestMatch?.distance ?? null,
        notes: "No match above threshold",
      });

      return json({
        ok: false,
        message: `Face not recognized (distance: ${bestMatch?.distance.toFixed(3) ?? "n/a"})`,
        distance: bestMatch?.distance ?? null,
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

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("attendance")
      .select("id, check_in_time")
      .eq("user_id", bestMatch.user_id)
      .eq("date", today)
      .maybeSingle();

    if (existingError) throw existingError;

    let attendanceId: string | null = null;
    let message = `Welcome, ${employeeName}! Check-in recorded.`;

    if (existing?.check_in_time) {
      attendanceId = existing.id;
      message = `${employeeName} already checked in today.`;
    } else if (existing) {
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
      notes: `Matched ${employeeName}`,
    });

    return json({
      ok: true,
      message,
      distance: bestMatch.distance,
      enrolledCount: validEnrollments.length,
      employeeName,
      attendanceId,
    });
  } catch (error) {
    console.error("Face hub check-in error:", error);
    const message = error instanceof Error ? error.message : "Face check-in failed.";
    return json({ ok: false, message }, 500);
  }
});