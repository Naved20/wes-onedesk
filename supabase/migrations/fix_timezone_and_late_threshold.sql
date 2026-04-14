-- ============================================================================
-- FIX TIMEZONE AND LATE THRESHOLD ISSUES
-- Run these commands in Supabase SQL Editor
-- ============================================================================

-- Step 1: Update late threshold from 1 minute to 15 minutes for all shifts
-- ============================================================================
UPDATE shifts 
SET late_threshold_minutes = 15 
WHERE late_threshold_minutes = 1;

-- Verify the update
SELECT id, name, start_time, end_time, late_threshold_minutes 
FROM shifts;


-- Step 2: Temporarily disable the prevent_absent_on_holidays trigger
-- ============================================================================
ALTER TABLE attendance DISABLE TRIGGER trigger_prevent_absent_on_holidays;


-- Step 3: Create timezone-aware calculate_attendance_status function
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_attendance_status(
  p_check_in_time TIMESTAMPTZ,
  p_shift_start TIME,
  p_shift_end TIME,
  p_late_threshold_minutes INTEGER,
  p_half_day_threshold_hours DECIMAL,
  p_last_checkin_hours_before_end DECIMAL
)
RETURNS VARCHAR AS $
DECLARE
  v_check_in_ist TIMESTAMPTZ;
  v_check_in_time TIME;
  v_shift_start_ist TIMESTAMPTZ;
  v_half_day_limit_ist TIMESTAMPTZ;
  v_last_checkin_limit_ist TIMESTAMPTZ;
  v_shift_end_ist TIMESTAMPTZ;
  v_check_in_date DATE;
BEGIN
  -- Convert UTC check-in time to IST (UTC+5:30)
  v_check_in_ist := p_check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata';
  
  -- Extract date and time from IST timestamp
  v_check_in_date := DATE(v_check_in_ist);
  v_check_in_time := v_check_in_ist::TIME;
  
  -- Create full IST timestamps for comparison using the IST date
  v_shift_start_ist := (v_check_in_date || ' ' || p_shift_start)::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';
  v_half_day_limit_ist := v_shift_start_ist + (p_half_day_threshold_hours || ' hours')::INTERVAL;
  v_shift_end_ist := (v_check_in_date || ' ' || p_shift_end)::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';
  v_last_checkin_limit_ist := v_shift_end_ist - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  
  -- Handle overnight shifts (when end time is before start time)
  IF p_shift_end < p_shift_start THEN
    v_shift_end_ist := v_shift_end_ist + INTERVAL '1 day';
    v_last_checkin_limit_ist := v_shift_end_ist - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  END IF;
  
  -- Determine status based on IST times
  IF v_check_in_ist >= v_last_checkin_limit_ist THEN
    RETURN 'absent';
  ELSIF v_check_in_ist >= v_half_day_limit_ist THEN
    RETURN 'half_day';
  ELSIF v_check_in_ist > (v_shift_start_ist + (p_late_threshold_minutes || ' minutes')::INTERVAL) THEN
    RETURN 'late';
  ELSE
    RETURN 'present';
  END IF;
END;
$ LANGUAGE plpgsql;


-- Step 4: Recalculate all attendance records (excluding holidays)
-- ============================================================================
-- First, let's see which records will be updated
SELECT 
  a.id,
  a.date,
  a.check_in_time,
  a.calculated_status as old_status,
  calculate_attendance_status(
    a.check_in_time,
    s.start_time,
    s.end_time,
    s.late_threshold_minutes,
    s.half_day_threshold_hours,
    s.last_checkin_hours_before_end
  ) as new_status,
  CASE 
    WHEN calculate_attendance_status(
      a.check_in_time,
      s.start_time,
      s.end_time,
      s.late_threshold_minutes,
      s.half_day_threshold_hours,
      s.last_checkin_hours_before_end
    ) = 'late' THEN true
    ELSE false
  END as should_be_late
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.check_in_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.date = a.date
  )
  AND EXTRACT(DOW FROM a.date) != 0  -- Exclude Sundays
ORDER BY a.date DESC
LIMIT 20;

-- Now update all records (excluding holidays and Sundays)
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
  END
FROM shifts s
WHERE a.shift_id = s.id
  AND a.check_in_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.date = a.date
  )
  AND EXTRACT(DOW FROM a.date) != 0;  -- Exclude Sundays


-- Step 5: Re-enable the prevent_absent_on_holidays trigger
-- ============================================================================
ALTER TABLE attendance ENABLE TRIGGER trigger_prevent_absent_on_holidays;


-- Step 6: Verify the results
-- ============================================================================
-- Check today's attendance with IST times
SELECT 
  a.id,
  a.date,
  a.check_in_time as check_in_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  a.calculated_status,
  a.is_late
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
ORDER BY a.check_in_time;

-- Check recent late records
SELECT 
  a.date,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  a.calculated_status,
  a.is_late
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.is_late = true
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY a.date DESC, a.check_in_time DESC
LIMIT 10;

-- ============================================================================
-- DONE! 
-- ============================================================================
-- Summary of changes:
-- 1. Updated late_threshold_minutes from 1 to 15 minutes
-- 2. Fixed calculate_attendance_status to convert UTC to IST before comparison
-- 3. Recalculated all attendance records with correct timezone handling
-- 4. Updated is_late flags based on new 15-minute threshold
-- ============================================================================
