-- Convert all existing check-in/check-out times from UTC to IST
-- And update the function to work with IST directly

-- Step 1: Convert all existing attendance records to IST
UPDATE attendance
SET 
  check_in_time = CASE 
    WHEN check_in_time IS NOT NULL 
    THEN check_in_time AT TIME ZONE 'Asia/Kolkata'
    ELSE NULL 
  END,
  check_out_time = CASE 
    WHEN check_out_time IS NOT NULL 
    THEN check_out_time AT TIME ZONE 'Asia/Kolkata'
    ELSE NULL 
  END;

-- Step 2: Update the calculate_attendance_status function to work with IST times directly
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
  v_check_in_date DATE;
  v_shift_start_ts TIMESTAMPTZ;
  v_half_day_limit_ts TIMESTAMPTZ;
  v_last_checkin_limit_ts TIMESTAMPTZ;
  v_shift_end_ts TIMESTAMPTZ;
BEGIN
  -- Extract date from check-in time (already in IST)
  v_check_in_date := DATE(p_check_in_time);
  
  -- Create full timestamps for comparison (IST)
  v_shift_start_ts := v_check_in_date + p_shift_start;
  v_half_day_limit_ts := v_shift_start_ts + (p_half_day_threshold_hours || ' hours')::INTERVAL;
  v_shift_end_ts := v_check_in_date + p_shift_end;
  v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  
  -- Handle overnight shifts
  IF p_shift_end < p_shift_start THEN
    v_shift_end_ts := v_shift_end_ts + INTERVAL '1 day';
    v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  END IF;
  
  -- Determine status (all times in IST)
  IF p_check_in_time >= v_last_checkin_limit_ts THEN
    RETURN 'absent';
  ELSIF p_check_in_time >= v_half_day_limit_ts THEN
    RETURN 'half_day';
  ELSIF p_check_in_time > (v_shift_start_ts + (p_late_threshold_minutes || ' minutes')::INTERVAL) THEN
    RETURN 'late';
  ELSE
    RETURN 'present';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_attendance_status IS 
'Calculates attendance status. All times are in IST (Asia/Kolkata) timezone.';

-- Step 3: Recalculate all attendance statuses with IST times
UPDATE attendance 
SET calculated_status = calculate_attendance_status(
  check_in_time,
  (SELECT start_time FROM shifts WHERE id = attendance.shift_id),
  (SELECT end_time FROM shifts WHERE id = attendance.shift_id),
  (SELECT late_threshold_minutes FROM shifts WHERE id = attendance.shift_id),
  (SELECT half_day_threshold_hours FROM shifts WHERE id = attendance.shift_id),
  (SELECT last_checkin_hours_before_end FROM shifts WHERE id = attendance.shift_id)
)
WHERE check_in_time IS NOT NULL;

-- Step 4: Update is_late flag
UPDATE attendance
SET is_late = (calculated_status = 'late')
WHERE check_in_time IS NOT NULL;
