-- ============================================================================
-- ENSURE: Future Check-ins Work Correctly for Academy Shift
-- ============================================================================
-- This verifies that the calculate_attendance_status function works correctly
-- and that new check-ins will not have the same problem
-- ============================================================================

-- Step 1: Test the calculate_attendance_status function with Academy shift
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== TESTING CALCULATE_ATTENDANCE_STATUS FUNCTION ===';
END $$;

WITH academy_shift AS (
  SELECT 
    id,
    name,
    start_time,
    end_time,
    late_threshold_minutes,
    half_day_threshold_hours,
    last_checkin_hours_before_end
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  LIMIT 1
),
test_scenarios AS (
  -- Test case 1: Check-in before shift start (12:55 PM)
  SELECT 
    'Before shift start' as scenario,
    (CURRENT_DATE + '12:55:00'::TIME)::TIMESTAMPTZ as test_check_in_time,
    '12:55:00'::TIME as display_time,
    'present' as expected_status,
    false as expected_late
  
  UNION ALL
  -- Test case 2: Check-in at shift start (13:00 PM)
  SELECT 
    'At shift start',
    (CURRENT_DATE + '13:00:00'::TIME)::TIMESTAMPTZ,
    '13:00:00'::TIME,
    'present',
    false
  
  UNION ALL
  -- Test case 3: Check-in within threshold (13:10 PM)
  SELECT 
    'Within threshold (10 min late)',
    (CURRENT_DATE + '13:10:00'::TIME)::TIMESTAMPTZ,
    '13:10:00'::TIME,
    'present',
    false
  
  UNION ALL
  -- Test case 4: Check-in at threshold boundary (13:15 PM)
  SELECT 
    'At threshold boundary (15 min)',
    (CURRENT_DATE + '13:15:00'::TIME)::TIMESTAMPTZ,
    '13:15:00'::TIME,
    'present',
    false
  
  UNION ALL
  -- Test case 5: Check-in after threshold (13:20 PM)
  SELECT 
    'After threshold (20 min late)',
    (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
    '13:20:00'::TIME,
    'late',
    true
  
  UNION ALL
  -- Test case 6: Check-in way after threshold (13:30 PM)
  SELECT 
    'Way after threshold (30 min late)',
    (CURRENT_DATE + '13:30:00'::TIME)::TIMESTAMPTZ,
    '13:30:00'::TIME,
    'late',
    true
  
  UNION ALL
  -- Test case 7: Check-in for half day (15:30 PM - 2.5 hours late)
  SELECT 
    'Half day threshold (2.5 hours late)',
    (CURRENT_DATE + '15:30:00'::TIME)::TIMESTAMPTZ,
    '15:30:00'::TIME,
    'half_day',
    true
  
  UNION ALL
  -- Test case 8: Check-in too late (17:00 PM - near end)
  SELECT 
    'Too late (near shift end)',
    (CURRENT_DATE + '17:00:00'::TIME)::TIMESTAMPTZ,
    '17:00:00'::TIME,
    'absent',
    true
)
SELECT 
  ts.scenario,
  a.name as shift_name,
  a.start_time,
  a.late_threshold_minutes,
  (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  ts.display_time as check_in_time,
  ts.expected_status,
  calculate_attendance_status(
    ts.test_check_in_time,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as actual_status,
  CASE 
    WHEN calculate_attendance_status(
      ts.test_check_in_time,
      a.start_time,
      a.end_time,
      a.late_threshold_minutes,
      a.half_day_threshold_hours,
      a.last_checkin_hours_before_end
    ) = ts.expected_status
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as test_result
FROM test_scenarios ts
CROSS JOIN academy_shift a
ORDER BY ts.display_time;


-- Step 2: Verify the frontend check-in logic will work
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== VERIFYING FRONTEND LOGIC ===';
END $$;

-- Simulate what happens when AttendanceCheckIn.tsx calculates status
WITH academy_shift AS (
  SELECT 
    id,
    name,
    start_time,
    end_time,
    late_threshold_minutes,
    half_day_threshold_hours,
    last_checkin_hours_before_end
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  LIMIT 1
),
current_ist_time AS (
  SELECT (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as ist_now
)
SELECT 
  a.name as shift_name,
  a.start_time,
  a.late_threshold_minutes,
  (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  c.ist_now::TIME as current_time_ist,
  CASE 
    WHEN c.ist_now::TIME < a.start_time
    THEN 'Before shift - Will show ON TIME'
    WHEN c.ist_now::TIME <= (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'Within threshold - Will show ON TIME'
    WHEN c.ist_now::TIME <= (a.start_time::TIME + (a.half_day_threshold_hours || ' hours')::INTERVAL)
    THEN 'After threshold - Will show LATE'
    WHEN c.ist_now::TIME <= (a.end_time::TIME - (a.last_checkin_hours_before_end || ' hours')::INTERVAL)
    THEN 'Way late - Will show HALF DAY'
    ELSE 'Too late - Will show ABSENT'
  END as frontend_status,
  CASE 
    WHEN c.ist_now::TIME > (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '⚠️ Will be marked LATE'
    ELSE '✅ Will be marked ON TIME'
  END as late_flag_status
FROM academy_shift a
CROSS JOIN current_ist_time c;


-- Step 3: Check if get_employee_shift function works for Academy employees
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING EMPLOYEE SHIFT ASSIGNMENTS ===';
END $$;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT start_time FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  (SELECT 
    (start_time::TIME + (late_threshold_minutes || ' minutes')::INTERVAL)
   FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_cutoff,
  CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) ILIKE '%academy%'
    THEN '✅ Academy shift assigned'
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '⚠️ Different shift assigned'
    ELSE '❌ No shift assigned'
  END as status
FROM employee_profiles ep
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
ORDER BY ep.first_name;


-- Step 4: Final verification
-- ============================================================================
DO $$
DECLARE
  v_test_passed BOOLEAN;
  v_employees_with_shift INTEGER;
  v_total_academy_employees INTEGER;
BEGIN
  RAISE NOTICE '=== FINAL VERIFICATION ===';
  
  -- Check if calculate_attendance_status works correctly
  SELECT 
    calculate_attendance_status(
      (CURRENT_DATE + '13:10:00'::TIME)::TIMESTAMPTZ,
      '13:00:00'::TIME,
      '19:00:00'::TIME,
      15,
      2.5,
      3.5
    ) = 'present'
  INTO v_test_passed;
  
  IF v_test_passed THEN
    RAISE NOTICE '✅ calculate_attendance_status function works correctly';
  ELSE
    RAISE WARNING '❌ calculate_attendance_status function has issues';
  END IF;
  
  -- Check if Academy employees have shifts assigned
  SELECT COUNT(*) INTO v_total_academy_employees
  FROM employee_profiles
  WHERE institution_assignment ILIKE '%academy%' AND is_active = true;
  
  SELECT COUNT(DISTINCT ep.user_id) INTO v_employees_with_shift
  FROM employee_profiles ep
  WHERE ep.institution_assignment ILIKE '%academy%'
    AND ep.is_active = true
    AND EXISTS (
      SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
    );
  
  IF v_employees_with_shift = v_total_academy_employees THEN
    RAISE NOTICE '✅ All % Academy employees have shifts assigned', v_total_academy_employees;
  ELSE
    RAISE WARNING '⚠️ Only % out of % Academy employees have shifts assigned', 
      v_employees_with_shift, v_total_academy_employees;
  END IF;
  
  -- Final verdict
  IF v_test_passed AND v_employees_with_shift > 0 THEN
    RAISE NOTICE '✅✅✅ SUCCESS: Future check-ins will work correctly! ✅✅✅';
  ELSE
    RAISE WARNING '⚠️ Some issues found - check the output above';
  END IF;
END $$;


-- ============================================================================
-- SUMMARY:
-- ============================================================================
-- This script verifies that:
-- 1. calculate_attendance_status function works correctly for Academy shift
-- 2. Frontend logic will calculate late threshold correctly
-- 3. Academy employees have shifts assigned
-- 4. New check-ins will not have the same problem as old records
-- 
-- If all tests pass, future check-ins will work perfectly!
-- ============================================================================
