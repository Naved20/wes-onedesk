-- VERIFICATION QUERIES - Run after migration to verify the fix
-- ================================================================

-- Query 1: Check overall April attendance summary
-- Should show reasonable late counts (not everyone marked late)
SELECT 
  'April 2026 Summary' as report,
  COUNT(*) as total_checkins,
  SUM(CASE WHEN is_late THEN 1 ELSE 0 END) as late_count,
  SUM(CASE WHEN NOT is_late THEN 1 ELSE 0 END) as on_time_count,
  ROUND(
    (SUM(CASE WHEN NOT is_late THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100), 2
  ) as on_time_percentage
FROM attendance
WHERE date >= '2026-04-01' 
  AND date < '2026-05-01'
  AND check_in_time IS NOT NULL;

-- Query 2: Check by shift - Academy should NOT have 100% late
-- All shifts should show reasonable late percentages
SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_after,
  COUNT(*) as total_checkins,
  SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as late_count,
  SUM(CASE WHEN NOT a.is_late THEN 1 ELSE 0 END) as on_time_count,
  ROUND(
    (SUM(CASE WHEN NOT a.is_late THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100), 2
  ) as on_time_percentage
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE a.date >= '2026-04-01'
  AND a.date < '2026-05-01'
  AND a.check_in_time IS NOT NULL
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY s.name;

-- Query 3: Check specific Academy shift cases (April 15-16)
-- These should show CORRECT late flags now
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_cutoff,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time as checkin_time_ist,
  a.is_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as expected_status,
  CASE 
    WHEN (a.is_late = true AND (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
      OR (a.is_late = false AND (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as verification
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND s.name = 'Academy'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date, a.check_in_time;

-- Query 4: Find any remaining mismatches (should return 0 rows)
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time as checkin_time_ist,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_cutoff,
  a.is_late,
  '❌ MISMATCH FOUND' as issue
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date >= '2026-04-01'
  AND a.date < '2026-05-01'
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status IN ('present', 'late')
  AND NOT (
    (a.is_late = true AND (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    OR (a.is_late = false AND (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
  )
ORDER BY s.name, a.date;

-- Query 5: Check date consistency (should return 0 rows)
-- Verify no date mismatches remain
SELECT 
  date,
  check_in_time,
  check_in_time::date as checkin_date,
  '❌ DATE MISMATCH' as issue
FROM attendance
WHERE date >= '2026-04-01'
  AND date < '2026-04-15'  -- Only checking dates we fixed
  AND check_in_time IS NOT NULL
  AND date::date != check_in_time::date;
