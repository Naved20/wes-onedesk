-- ============================================================================
-- AUTO-MARK ABSENT AFTER SHIFT'S LAST CHECK-IN TIME ENDS
-- This creates absent records automatically when shift's last check-in time passes
-- ============================================================================

-- Step 1: Improved function to create absent records based on shift timing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_absent_records_for_date(p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_employee RECORD;
  v_shift RECORD;
  v_current_time TIME;
  v_last_checkin_limit TIMESTAMP;
BEGIN
  -- Don't create absent records for future dates
  IF p_date > CURRENT_DATE THEN
    RETURN 0;
  END IF;

  -- Don't create absent records for holidays (including Sundays)
  IF is_holiday_date(p_date) THEN
    RETURN 0;
  END IF;

  -- Get current time in IST
  v_current_time := (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME;

  -- Loop through all active employees who don't have attendance record for this date
  FOR v_employee IN 
    SELECT ep.user_id
    FROM employee_profiles ep
    WHERE ep.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.user_id = ep.user_id
        AND a.date = p_date
      )
  LOOP
    -- Get employee's shift for this date
    SELECT * INTO v_shift
    FROM get_employee_shift(v_employee.user_id, p_date)
    LIMIT 1;

    -- If employee has a shift assigned
    IF v_shift.shift_id IS NOT NULL THEN
      -- Calculate last check-in limit time
      -- last_checkin_limit = shift_end - last_checkin_hours_before_end
      v_last_checkin_limit := (p_date + v_shift.end_time) - 
                              (v_shift.last_checkin_hours_before_end || ' hours')::INTERVAL;
      
      -- Handle overnight shifts
      IF v_shift.end_time < v_shift.start_time THEN
        v_last_checkin_limit := v_last_checkin_limit + INTERVAL '1 day';
      END IF;

      -- Only create absent record if:
      -- 1. It's the same date as p_date, OR
      -- 2. Current time has passed the last check-in limit
      IF p_date < CURRENT_DATE OR 
         (p_date = CURRENT_DATE AND NOW() >= v_last_checkin_limit) THEN
        
        -- Create absent record with shift_id
        INSERT INTO attendance (
          user_id,
          date,
          check_in_time,
          check_out_time,
          status,
          calculated_status,
          is_late,
          is_half_day,
          half_day_type,
          notes,
          shift_id,
          is_manual_override,
          created_at,
          updated_at
        ) VALUES (
          v_employee.user_id,
          p_date,
          NULL,
          NULL,
          'rejected',
          'absent',
          false,
          false,
          NULL,
          'Auto-marked absent - No check-in after shift deadline',
          v_shift.shift_id,
          false,
          NOW(),
          NOW()
        );
        
        v_count := v_count + 1;
      END IF;
    ELSE
      -- Employee has no shift assigned - still mark absent for past dates
      IF p_date < CURRENT_DATE THEN
        INSERT INTO attendance (
          user_id,
          date,
          check_in_time,
          check_out_time,
          status,
          calculated_status,
          is_late,
          is_half_day,
          half_day_type,
          notes,
          shift_id,
          is_manual_override,
          created_at,
          updated_at
        ) VALUES (
          v_employee.user_id,
          p_date,
          NULL,
          NULL,
          'rejected',
          'absent',
          false,
          false,
          NULL,
          'Auto-marked absent - No shift assigned',
          NULL,
          false,
          NOW(),
          NOW()
        );
        
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.create_absent_records_for_date(DATE) IS 
'Creates absent records for employees who did not check in. For today, only creates absent records after shift last check-in time has passed. Skips holidays and Sundays.';


-- Step 2: Create a scheduled job to auto-create absent records
-- ============================================================================
-- This will run every hour to check and create absent records for today

-- First, enable pg_cron extension if not already enabled
-- (This needs to be run by superuser in Supabase dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job (uncomment to enable)
-- SELECT cron.schedule(
--   'auto-create-absent-records',
--   '0 * * * *', -- Run every hour
--   $$SELECT create_absent_records_for_date(CURRENT_DATE)$$
-- );


-- Step 3: Manual trigger function for immediate execution
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_absent_records_now()
RETURNS TABLE(
  date DATE,
  records_created INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Create absent records for today
  v_count := create_absent_records_for_date(CURRENT_DATE);
  
  date := CURRENT_DATE;
  records_created := v_count;
  message := 'Created ' || v_count || ' absent record(s) for ' || CURRENT_DATE;
  
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.trigger_absent_records_now() IS 
'Manually trigger creation of absent records for today. Use this to immediately create absent records after shift deadlines pass.';


-- Step 4: Backfill absent records for April 2026 (OPTIONAL - Run manually if needed)
-- ============================================================================
-- Uncomment and run manually in SQL Editor if you want to backfill past dates:
-- SELECT * FROM create_absent_records_for_range(
--   '2026-04-01'::DATE, 
--   (CURRENT_DATE - INTERVAL '1 day')::DATE
-- );


-- Step 5: Usage instructions (commented)
-- ============================================================================
-- To manually create absent records for today:
-- SELECT * FROM trigger_absent_records_now();

-- To create absent records for a specific date:
-- SELECT create_absent_records_for_date('2026-04-17');

-- To create absent records for a date range:
-- SELECT * FROM create_absent_records_for_range('2026-04-01', '2026-04-17');

-- To check which employees will be marked absent today:
-- SELECT 
--   ep.first_name || ' ' || ep.last_name as employee_name,
--   s.name as shift_name,
--   s.end_time,
--   s.last_checkin_hours_before_end,
--   (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline
-- FROM employee_profiles ep
-- JOIN employee_shifts es ON ep.user_id = es.user_id
-- JOIN shifts s ON es.shift_id = s.id
-- WHERE ep.is_active = true
--   AND es.effective_from <= CURRENT_DATE
--   AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
--   AND NOT EXISTS (
--     SELECT 1 FROM attendance a
--     WHERE a.user_id = ep.user_id
--     AND a.date = CURRENT_DATE
--   )
-- ORDER BY last_checkin_deadline;

