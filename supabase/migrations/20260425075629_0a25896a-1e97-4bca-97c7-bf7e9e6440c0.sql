
-- Fix is_late calculation to use the employee's shift start_time + late_threshold_minutes
-- instead of the hardcoded "after 11 AM IST" rule.

CREATE OR REPLACE FUNCTION public.handle_attendance_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift RECORD;
  v_check_in_ist TIMESTAMP;
  v_check_in_date DATE;
  v_shift_start_ts TIMESTAMP;
  v_late_cutoff_ts TIMESTAMP;
BEGIN
  -- Only auto-calculate if NOT manual override and we have a check-in time
  IF NEW.check_in_time IS NOT NULL
     AND (NEW.is_manual_override IS NULL OR NEW.is_manual_override = false) THEN

    -- Try to use the shift attached to this attendance row first;
    -- otherwise look up the employee's shift for that date.
    IF NEW.shift_id IS NOT NULL THEN
      SELECT s.start_time, s.late_threshold_minutes
      INTO v_shift
      FROM shifts s
      WHERE s.id = NEW.shift_id;
    ELSE
      SELECT gs.start_time, gs.late_threshold_minutes
      INTO v_shift
      FROM get_employee_shift(NEW.user_id, NEW.date) gs
      LIMIT 1;
    END IF;

    IF v_shift.start_time IS NOT NULL THEN
      -- Convert UTC check-in to IST
      v_check_in_ist := NEW.check_in_time AT TIME ZONE 'Asia/Kolkata';
      v_check_in_date := DATE(v_check_in_ist);

      v_shift_start_ts := v_check_in_date + v_shift.start_time;
      v_late_cutoff_ts := v_shift_start_ts
                          + (COALESCE(v_shift.late_threshold_minutes, 0) || ' minutes')::INTERVAL;

      NEW.is_late := v_check_in_ist > v_late_cutoff_ts;
    ELSE
      -- No shift assigned -> fall back to the legacy hardcoded rule
      NEW.is_late := is_late_checkin(NEW.check_in_time);
    END IF;
  END IF;

  IF NEW.is_half_day THEN
    NEW.presence_value := 0.5;
  ELSE
    NEW.presence_value := 1.0;
  END IF;

  IF NEW.is_late
     AND (OLD IS NULL OR OLD.is_late = false)
     AND (NEW.is_manual_override IS NULL OR NEW.is_manual_override = false) THEN
    NEW.notes := COALESCE(NEW.notes, '') ||
      CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' THEN ' | ' ELSE '' END ||
      'Late check-in flagged for review';
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: re-compute is_late for the last 30 days of non-manual check-ins
-- so the Academy (and other shifts) records get corrected.
UPDATE attendance a
SET is_late = (
  (a.check_in_time AT TIME ZONE 'Asia/Kolkata')
  > ((DATE(a.check_in_time AT TIME ZONE 'Asia/Kolkata') + s.start_time)
     + (COALESCE(s.late_threshold_minutes, 0) || ' minutes')::INTERVAL)
)
FROM shifts s
WHERE a.shift_id = s.id
  AND a.check_in_time IS NOT NULL
  AND (a.is_manual_override IS NULL OR a.is_manual_override = false)
  AND a.date >= CURRENT_DATE - INTERVAL '30 days';
