
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
  v_check_in_time_only TIME;
  v_check_in_date DATE;
  v_shift_start_ts TIMESTAMP;
  v_shift_end_ts TIMESTAMP;
  v_late_threshold_ts TIMESTAMP;
  v_half_day_limit_ts TIMESTAMP;
  v_last_checkin_limit_ts TIMESTAMP;
  v_check_in_ist TIMESTAMP;
BEGIN
  -- Convert UTC timestamp to IST using PostgreSQL's timezone conversion
  v_check_in_ist := (p_check_in_time AT TIME ZONE 'Asia/Kolkata')::TIMESTAMP;
  
  -- Get date and time in IST
  v_check_in_date := DATE(v_check_in_ist);
  v_check_in_time_only := v_check_in_ist::TIME;
  
  -- Build timestamps using IST date and shift times (which are already in IST)
  v_shift_start_ts := v_check_in_date + p_shift_start;
  v_shift_end_ts := v_check_in_date + p_shift_end;
  
  -- Handle overnight shifts
  IF p_shift_end < p_shift_start THEN
    IF v_check_in_time_only < p_shift_start THEN
      v_shift_start_ts := v_shift_start_ts - INTERVAL '1 day';
    ELSE
      v_shift_end_ts := v_shift_end_ts + INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Calculate thresholds
  v_late_threshold_ts := v_shift_start_ts + (p_late_threshold_minutes || ' minutes')::INTERVAL;
  v_half_day_limit_ts := v_shift_start_ts + (p_half_day_threshold_hours || ' hours')::INTERVAL;
  v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  
  -- Compare check-in time (in IST) with thresholds
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
'Calculates attendance status by converting UTC check-in time to IST and comparing with shift timings (stored in IST). Fixed to properly handle timezone conversion for accurate late threshold comparison.';
