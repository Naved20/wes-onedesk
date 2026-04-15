-- Comprehensive fix for attendance times
-- This corrects all historical attendance records by adjusting for timezone offset issues

UPDATE attendance
SET 
  check_in_time = CASE 
    WHEN check_in_time IS NOT NULL 
    THEN check_in_time + INTERVAL '5 hours 30 minutes'
    ELSE NULL 
  END,
  check_out_time = CASE 
    WHEN check_out_time IS NOT NULL 
    THEN check_out_time + INTERVAL '5 hours 30 minutes'
    ELSE NULL 
  END,
  updated_at = NOW()
WHERE 
  date < (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date
  AND (check_in_time IS NOT NULL OR check_out_time IS NOT NULL);
