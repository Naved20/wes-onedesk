-- ============================================================================
-- SHOW WRONG LATE FLAGS: Which 10 records have incorrect late flags?
-- Run this in Supabase SQL Editor
-- ============================================================================

SELECT 
  ROW_NUMBER() OVER (ORDER BY a.check_in_time) as sr_no,
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_time_only,
  a.is_late as currently_marked,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'LATE'
    ELSE 'ON TIME'
  END as should_be,
  CASE 
    WHEN a.is_late = true THEN 'Marked LATE'
    ELSE 'Marked ON TIME'
  END as current_status,
  CASE 
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN '✅ Correctly marked LATE'
    WHEN (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN '✅ Correctly marked ON TIME'
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN '❌ WRONG - Marked LATE but came ON TIME'
    ELSE '❌ WRONG - Marked ON TIME but came LATE'
  END as issue
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
  AND NOT (
    (a.is_late = true 
     AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    OR (a.is_late = false 
        AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
            <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
  )
ORDER BY a.check_in_time;


-- Summary by shift
-- ============================================================================
SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  COUNT(*) as total_wrong_records,
  SUM(CASE WHEN a.is_late = true THEN 1 ELSE 0 END) as marked_late_but_ontime,
  SUM(CASE WHEN a.is_late = false THEN 1 ELSE 0 END) as marked_ontime_but_late
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
  AND NOT (
    (a.is_late = true 
     AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    OR (a.is_late = false 
        AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
            <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
  )
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY total_wrong_records DESC;

