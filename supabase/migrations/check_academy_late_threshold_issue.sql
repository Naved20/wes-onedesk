-- ============================================================================
-- CHECK: Academy Shift Late Threshold Issue - Current Status
-- ============================================================================

-- Step 1: Show current shift configuration
-- ============================================================================
SELECT 
  '=== CURRENT SHIFT CONFIGURATION ===' as section;

SELECT 
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  s.half_day_threshold_hours,
  s.last_checkin_hours_before_end,
  s.is_active,
  COUNT(DISTINCT es.user_id) as employees_assigned
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.name ILIKE '%academy%'
GROUP BY s.id, s.name, s.start_time, s.end_time, s.late_threshold_minutes,
         s.half_day_threshold_hours, s.last_checkin_hours_before_end, s.is_active
ORDER BY s.name;


-- Step 2: Check recent Academy attendance records (last 7 days)
-- ============================================================================
SELECT 
  '=== RECENT ACADEMY ATTENDANCE (Last 7 Days) ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  a.is_late as marked_late,
  a.calculated_status,
  a.status,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ Should be LATE'
    ELSE '✅ Should be ON TIME'
  END as correct_status,
  CASE 
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as verification
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE s.name ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date DESC, a.check_in_time;


-- Step 3: Count wrong late flags
-- ============================================================================
SELECT 
  '=== SUMMARY OF WRONG LATE FLAGS ===' as section;

SELECT 
  s.name as shift_name,
  COUNT(*) as total_records,
  SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as marked_late_count,
  SUM(CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 1 ELSE 0 END) as should_be_late_count,
  SUM(CASE 
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 1 
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 1
    ELSE 0 
  END) as wrong_flags_count
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE s.name ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
GROUP BY s.name;


-- Step 4: Test calculate_attendance_status function
-- ============================================================================
SELECT 
  '=== TEST FUNCTION WITH SAMPLE TIMES ===' as section;

WITH test_cases AS (
  SELECT 
    s.name as shift_name,
    s.start_time,
    s.late_threshold_minutes,
    (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
    '12:55:00'::TIME as test_time_1,
    '13:10:00'::TIME as test_time_2,
    '13:20:00'::TIME as test_time_3
  FROM shifts s
  WHERE s.name ILIKE '%academy%' AND s.is_active = true
  LIMIT 1
)
SELECT 
  shift_name,
  start_time,
  late_threshold_minutes,
  late_cutoff,
  test_time_1 as check_in_time,
  '12:55 PM (Before shift)' as scenario,
  CASE WHEN test_time_1 > late_cutoff THEN 'LATE' ELSE 'ON TIME' END as expected,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_1)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,
    late_threshold_minutes,
    2.5,
    3.5
  ) as function_result
FROM test_cases
UNION ALL
SELECT 
  shift_name,
  start_time,
  late_threshold_minutes,
  late_cutoff,
  test_time_2,
  '13:10 PM (Within threshold)',
  CASE WHEN test_time_2 > late_cutoff THEN 'LATE' ELSE 'ON TIME' END,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_2)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,
    late_threshold_minutes,
    2.5,
    3.5
  )
FROM test_cases
UNION ALL
SELECT 
  shift_name,
  start_time,
  late_threshold_minutes,
  late_cutoff,
  test_time_3,
  '13:20 PM (After threshold)',
  CASE WHEN test_time_3 > late_cutoff THEN 'LATE' ELSE 'ON TIME' END,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_3)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,
    late_threshold_minutes,
    2.5,
    3.5
  )
FROM test_cases;


-- Step 5: Final diagnosis
-- ============================================================================
SELECT 
  '=== DIAGNOSIS ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN shifts s ON a.shift_id = s.id
      WHERE s.name ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '7 days'
        AND a.check_in_time IS NOT NULL
        AND (
          (a.is_late = true 
           AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
               <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
          OR
          (a.is_late = false 
           AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
               > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
        )
    )
    THEN '❌ PROBLEM FOUND: Academy shift has wrong late flags'
    ELSE '✅ NO PROBLEM: All late flags are correct'
  END as diagnosis,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN shifts s ON a.shift_id = s.id
      WHERE s.name ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '7 days'
        AND a.check_in_time IS NOT NULL
        AND (
          (a.is_late = true 
           AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
               <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
          OR
          (a.is_late = false 
           AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
               > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
        )
    )
    THEN 'Run fix_academy_late_threshold_final.sql to fix the issue'
    ELSE 'No action needed'
  END as recommended_action;
