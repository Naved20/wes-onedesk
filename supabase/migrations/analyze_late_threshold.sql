-- Analysis Query: Check if Late Threshold is working correctly for each shift
-- Run this in Supabase SQL Editor

-- Step 1: Get all shifts with their late threshold settings
SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_after_time,
  COUNT(DISTINCT es.user_id) as total_employees
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY s.name;

-- Step 2: Analyze actual attendance vs late threshold (April 15-16 only - clean data)
SELECT 
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_cutoff_time,
  a.date,
  a.check_in_time::time as actual_checkin_time,
  a.is_late as marked_as_late,
  CASE 
    WHEN a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as expected_status,
  CASE 
    WHEN (a.is_late = true AND a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
      OR (a.is_late = false AND a.check_in_time::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as threshold_working,
  ep.first_name || ' ' || ep.last_name as employee_name
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status = 'present'
ORDER BY s.name, a.date, a.check_in_time;

-- Step 3: Summary by shift - How many correct vs wrong
SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  COUNT(*) as total_records,
  SUM(CASE 
    WHEN (a.is_late = true AND a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
      OR (a.is_late = false AND a.check_in_time::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    THEN 1 ELSE 0 
  END) as correct_count,
  SUM(CASE 
    WHEN (a.is_late = true AND a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
      OR (a.is_late = false AND a.check_in_time::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    THEN 0 ELSE 1 
  END) as wrong_count,
  ROUND(
    (SUM(CASE 
      WHEN (a.is_late = true AND a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
        OR (a.is_late = false AND a.check_in_time::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
      THEN 1 ELSE 0 
    END)::numeric / COUNT(*)::numeric * 100), 2
  ) as accuracy_percentage
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status = 'present'
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY accuracy_percentage DESC;

-- Step 4: Find specific problematic cases
SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  a.date,
  a.check_in_time,
  a.check_in_time::time as time_only,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_cutoff,
  a.is_late,
  ep.first_name || ' ' || ep.last_name as employee_name,
  '❌ MISMATCH' as issue
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status = 'present'
  AND NOT (
    (a.is_late = true AND a.check_in_time::time > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
    OR (a.is_late = false AND a.check_in_time::time <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval))
  )
ORDER BY s.name, a.date;
