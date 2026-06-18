-- Fix leave type to attendance calculated_status mapping:
--   medical  -> paid_leave (no salary deduction)
--   emergency -> leave    (salary deduction like LOP)
--   casual   -> paid_leave (no deduction, unchanged)
--   sick/unplanned/lop/other -> leave (deduction, unchanged)

CREATE OR REPLACE FUNCTION public.sync_leave_to_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current DATE;
  v_calc_status VARCHAR;
  v_is_half BOOLEAN;
  v_notes TEXT;
BEGIN
  -- Only act when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- Map leave type to calculated_status
    -- medical = paid leave (PL), no deduction
    -- emergency = leave (LE), deduction like LOP
    -- casual = paid leave (PL), no deduction
    -- all others = leave (LE), deduction
    IF NEW.leave_type IN ('casual', 'medical') THEN
      v_calc_status := 'paid_leave';
    ELSIF NEW.leave_type IN ('emergency', 'lop', 'sick', 'unplanned') THEN
      v_calc_status := 'leave';
    ELSE
      v_calc_status := 'leave';
    END IF;

    v_is_half := COALESCE(NEW.is_half_day, false);
    v_notes := 'Auto-synced from approved ' || NEW.leave_type::text || ' leave (id: ' || NEW.id || ')';

    v_current := NEW.start_date;
    WHILE v_current <= NEW.end_date LOOP
      -- Skip holidays
      IF NOT is_holiday_date(v_current) THEN
        INSERT INTO attendance (
          user_id, date, status, calculated_status,
          is_half_day, half_day_type,
          is_manual_override, notes,
          approved_at, approved_by
        ) VALUES (
          NEW.user_id, v_current, 'approved', v_calc_status,
          v_is_half, CASE WHEN v_is_half THEN COALESCE(NEW.half_day_type, 'first_half') ELSE NULL END,
          true, v_notes,
          NOW(), COALESCE(NEW.approved_by, auth.uid())
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          status = 'approved',
          calculated_status = EXCLUDED.calculated_status,
          is_half_day = EXCLUDED.is_half_day,
          half_day_type = EXCLUDED.half_day_type,
          is_manual_override = true,
          notes = EXCLUDED.notes,
          approved_at = NOW(),
          approved_by = EXCLUDED.approved_by,
          updated_at = NOW();
      END IF;
      v_current := v_current + 1;
    END LOOP;
  END IF;

  -- If approved leave is later changed away from approved, revert synced rows to pending
  IF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE attendance
    SET status = 'pending',
        calculated_status = NULL,
        is_half_day = false,
        half_day_type = NULL,
        is_manual_override = false,
        notes = 'Leave revoked - reverted to pending',
        updated_at = NOW()
    WHERE user_id = OLD.user_id
      AND date BETWEEN OLD.start_date AND OLD.end_date
      AND notes LIKE '%' || OLD.id::text || '%';
  END IF;

  RETURN NEW;
END;
$$;

-- Also fix the insert trigger
CREATE OR REPLACE FUNCTION public.sync_leave_to_attendance_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current DATE;
  v_calc_status VARCHAR;
  v_is_half BOOLEAN;
  v_notes TEXT;
BEGIN
  IF NEW.status = 'approved' THEN
    IF NEW.leave_type IN ('casual', 'medical') THEN
      v_calc_status := 'paid_leave';
    ELSIF NEW.leave_type IN ('emergency', 'lop', 'sick', 'unplanned') THEN
      v_calc_status := 'leave';
    ELSE
      v_calc_status := 'leave';
    END IF;

    v_is_half := COALESCE(NEW.is_half_day, false);
    v_notes := 'Auto-synced from approved ' || NEW.leave_type::text || ' leave (id: ' || NEW.id || ')';

    v_current := NEW.start_date;
    WHILE v_current <= NEW.end_date LOOP
      IF NOT is_holiday_date(v_current) THEN
        INSERT INTO attendance (
          user_id, date, status, calculated_status,
          is_half_day, half_day_type,
          is_manual_override, notes,
          approved_at, approved_by
        ) VALUES (
          NEW.user_id, v_current, 'approved', v_calc_status,
          v_is_half, CASE WHEN v_is_half THEN COALESCE(NEW.half_day_type, 'first_half') ELSE NULL END,
          true, v_notes,
          NOW(), COALESCE(NEW.approved_by, auth.uid())
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          status = 'approved',
          calculated_status = EXCLUDED.calculated_status,
          is_half_day = EXCLUDED.is_half_day,
          half_day_type = EXCLUDED.half_day_type,
          is_manual_override = true,
          notes = EXCLUDED.notes,
          approved_at = NOW(),
          approved_by = EXCLUDED.approved_by,
          updated_at = NOW();
      END IF;
      v_current := v_current + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate triggers (they already exist, just ensuring function is updated)
DROP TRIGGER IF EXISTS trg_sync_leave_to_attendance ON public.leaves;
CREATE TRIGGER trg_sync_leave_to_attendance
AFTER UPDATE ON public.leaves
FOR EACH ROW
EXECUTE FUNCTION public.sync_leave_to_attendance();

DROP TRIGGER IF EXISTS trg_sync_leave_to_attendance_insert ON public.leaves;
CREATE TRIGGER trg_sync_leave_to_attendance_insert
AFTER INSERT ON public.leaves
FOR EACH ROW
EXECUTE FUNCTION public.sync_leave_to_attendance_insert();

-- Backfill: fix already-approved leaves with correct calculated_status
DO $$
DECLARE
  r RECORD;
  v_current DATE;
  v_calc_status VARCHAR;
  v_is_half BOOLEAN;
  v_notes TEXT;
BEGIN
  FOR r IN SELECT * FROM leaves WHERE status = 'approved' LOOP
    IF r.leave_type IN ('casual', 'medical') THEN
      v_calc_status := 'paid_leave';
    ELSIF r.leave_type IN ('emergency', 'lop', 'sick', 'unplanned') THEN
      v_calc_status := 'leave';
    ELSE
      v_calc_status := 'leave';
    END IF;

    v_is_half := COALESCE(r.is_half_day, false);
    v_notes := 'Auto-synced from approved ' || r.leave_type::text || ' leave (id: ' || r.id || ')';

    v_current := r.start_date;
    WHILE v_current <= r.end_date LOOP
      IF NOT is_holiday_date(v_current) THEN
        INSERT INTO attendance (
          user_id, date, status, calculated_status,
          is_half_day, half_day_type,
          is_manual_override, notes, approved_at, approved_by
        ) VALUES (
          r.user_id, v_current, 'approved', v_calc_status,
          v_is_half, CASE WHEN v_is_half THEN COALESCE(r.half_day_type, 'first_half') ELSE NULL END,
          true, v_notes, NOW(), r.approved_by
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          status = 'approved',
          calculated_status = EXCLUDED.calculated_status,
          is_half_day = EXCLUDED.is_half_day,
          half_day_type = EXCLUDED.half_day_type,
          is_manual_override = true,
          notes = EXCLUDED.notes,
          approved_at = NOW(),
          approved_by = EXCLUDED.approved_by,
          updated_at = NOW();
      END IF;
      v_current := v_current + 1;
    END LOOP;
  END LOOP;
END $$;
