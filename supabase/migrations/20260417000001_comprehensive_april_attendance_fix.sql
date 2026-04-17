-- ============================================================================
-- COMPREHENSIVE FIX FOR APRIL 2026 ATTENDANCE ISSUES
-- This migration fixes:
-- 1. Date-time mismatch (check_in_time showing previous day)
-- 2. Incorrect is_late flags due to timezone comparison issues
-- 3. Recalculates all statuses with proper IST timezone handling
-- ============================================================================

-- Step 1: Fix the calculate_attendance_status function to properly handle UTC to IST conversion
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_attendance_status(
  p_check_in_time TIMESTAMPTZ,
  p_shift_start TIME,
  p_shift_end TIME,
  p_late_threshold_minutes INTEGER,
  p_half_day_threshold_hours DECIMAL,
  p_last_checkin_hours_before_end DECIMAL
)
RETURNS VARCHAR AS $$
DECLARE
  v_check_in_ist TIMESTAMP;
  v_check_in_time_only TIME;
  v_check_in_date DATE;
  v_shift_start_ts TIMESTAMP;
  v_shift_end_ts TIMESTAMP;
  v_late_threshold_ts TIMESTAMP;
  v_half_day_limit_ts TIMESTAMP;
  v_last_checkin_limit_ts TIMESTAMP;
BEGIN
  -- Convert UTC timestamp to IST (Asia/Kolkata = UTC+5:30)
  -- This ensures we're comparing apples to apples
  v_check_in_ist := (p_check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIMESTAMP;
  
  -- Extract date and time in IST
  v_check_in_date := DATE(v_check_in_ist);
  v_check_in_time_only := v_check_in_ist::TIME;
  
  -- Build shift timestamps using IST date
  v_shift_start_ts := v_check_in_date + p_shift_start;
  v_shift_end_ts := v_check_in_date + p_shift_end;
  
  -- Handle overnight shifts (e.g., 22:00 to 06:00)
  IF p_shift_end < p_shift_start THEN
    IF v_check_in_time_only < p_shift_start THEN
      -- Check-in is after midnight, shift started yesterday
      v_shift_start_ts := v_shift_start_ts - INTERVAL '1 day';
    ELSE
      -- Check-in is before midnight, shift ends tomorrow
      v_shift_end_ts := v_shift_end_ts + INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Calculate all thresholds in IST
  v_late_threshold_ts := v_shift_start_ts + (p_late_threshold_minutes || ' minutes')::INTERVAL;
  v_half_day_limit_ts := v_shift_start_ts + (p_half_day_threshold_hours || ' hours')::INTERVAL;
  v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  
  -- Compare IST check-in time with IST thresholds
  IF v_check_in_ist >= v_last_checkin_limit_ts THEN
    RETURN 'absent';
  ELSIF v_check_in_ist >= v_half_day_limit_ts THEN
    RETURN 'half_day';
  ELSIF v_check_in_ist > v_late_threshold_ts THEN
    RETURN 'late';
  ELSE
    RETURN 'present';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_attendance_status IS 
'Calculates attendance status by converting UTC check-in time to IST before comparison. This ensures accurate late threshold detection regardless of timezone storage.';


-- Step 2: Fix April 1-14 attendance records (excluding 15-16 as per user request)
-- ============================================================================
-- Add 5 hours 30 minutes to check-in times to convert from UTC to IST display
UPDATE attendance
SET 
  check_in_time = check_in_time + INTERVAL '5 hours 30 minutes',
  updated_at = NOW()
WHERE 
  date >= '2026-04-01'
  AND date <= '2026-04-14'
  AND check_in_time IS NOT NULL;


-- Step 3: Recalculate all April attendance statuses with corrected function
-- ============================================================================
UPDATE attendance a
SET 
  calculated_status = calculate_attendance_status(
    a.check_in_time,
    s.start_time,
    s.end_time,
    s.late_threshold_minutes,
    s.half_day_threshold_hours,
    s.last_checkin_hours_before_end
  ),
  is_late = CASE 
    WHEN calculate_attendance_status(
      a.check_in_time,
      s.start_time,
      s.end_time,
      s.late_threshold_minutes,
      s.half_day_threshold_hours,
      s.last_checkin_hours_before_end
    ) = 'late' THEN true
    ELSE false
  END,
  updated_at = NOW()
FROM shifts s
WHERE a.shift_id = s.id
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01'
  AND a.date <= '2026-04-30';


-- Step 4: Verification queries (commented out - uncomment to check results)
-- ============================================================================
-- Check Academy shift employees on April 15-16 to verify late threshold is working
-- SELECT 
--   a.date,
--   a.check_in_time,
--   (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist_time,
--   s.name as shift_name,
--   s.start_time,
--   s.late_threshold_minutes,
--   (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
--   a.calculated_status,
--   a.is_late,
--   ep.first_name || ' ' || ep.last_name as employee_name
-- FROM attendance a
-- JOIN shifts s ON a.shift_id = s.id
-- JOIN employee_profiles ep ON a.user_id = ep.user_id
-- WHERE a.date IN ('2026-04-15', '2026-04-16')
--   AND s.name ILIKE '%academy%'
--   AND a.check_in_time IS NOT NULL
-- ORDER BY a.date, a.check_in_time;

-- Check all April records summary
-- SELECT 
--   a.date,
--   COUNT(*) as total_records,
--   SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as late_count,
--   SUM(CASE WHEN a.calculated_status = 'present' THEN 1 ELSE 0 END) as present_count,
--   SUM(CASE WHEN a.calculated_status = 'absent' THEN 1 ELSE 0 END) as absent_count
-- FROM attendance a
-- WHERE a.date >= '2026-04-01' AND a.date <= '2026-04-30'
-- GROUP BY a.date
-- ORDER BY a.date;

