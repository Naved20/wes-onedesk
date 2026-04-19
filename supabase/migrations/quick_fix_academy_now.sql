-- ============================================================================
-- QUICK FIX: Academy Shift Late Threshold - Run This Now
-- ============================================================================

-- Fix ALL Academy shift attendance records
UPDATE attendance a
SET 
  is_late = CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN true
    ELSE false
  END,
  calculated_status = CASE
    -- Check if too late (absent)
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
         >= (
           (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.end_time)
           - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
         )
    THEN 'absent'
    -- Check if half day
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
         >= (
           (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.start_time)
           + (s.half_day_threshold_hours || ' hours')::INTERVAL
         )
    THEN 'half_day'
    -- Check if late
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'late'
    -- Otherwise present
    ELSE 'present'
  END,
  updated_at = NOW()
FROM shifts s
WHERE a.shift_id = s.id
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01';

-- Verify the fix
SELECT 
  'Fixed ' || COUNT(*) || ' Academy attendance records' as result
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01';
