-- ============================================================================
-- TEST: Why ANY New Shift's Late Threshold Doesn't Work
-- Comprehensive test for all shifts
-- ============================================================================

-- Step 1: Check ALL active shifts configuration
-- ============================================================================
SELECT 
  '=== ALL ACTIVE SHIFTS ===' as section;

SELECT 
  name,
  start_time,
  end_time,
  late_threshold_minutes,
  (start_time::TIME + (late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  is_active,
  created_at
FROM shifts
WHERE is_active = true
ORDER BY created_at DESC;


-- Step 2: Test calculate_attendance_status function for each shift
-- ============================================================================
SELECT 
  '=== FUNCTION TEST FOR ALL SHIFTS ===' as section;

WITH shift_tests AS (
  SELECT 
    s.name as shift_name,
    s.start_time,
    s.late_threshold_minutes,
    (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
    -- Test time: 5 minutes before late cutoff (should be ON TIME)
    (s.start_time::TIME + ((s.late_threshold_minutes - 5) || ' minutes')::INTERVAL) as test_time_ontime,
    -- Test time: 5 minutes after late cutoff (should be LATE)
    (s.start_time::TIME + ((s.late_threshold_minutes + 5) || ' minutes')::INTERVAL) as test_time_late
  FROM shifts s
  WHERE s.is_active = true
)
SELECT 
  shift_name,
  start_time,
  late_threshold_minutes,
  late_cutoff,
  test_time_ontime,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_ontime)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,  -- Assuming 7 PM end time
    late_threshold_minutes,
    2.5,
    3.5
  ) as result_ontime,
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + test_time_ontime)::TIMESTAMPTZ,
      start_time,
      '19:00:00'::TIME,
      late_threshold_minutes,
      2.5,
      3.5
    ) IN ('present', 'late')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as test_ontime_status,
  test_time_late,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_late)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,
    late_threshold_minutes,
    2.5,
    3.5
  ) as result_late,
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + test_time_late)::TIMESTAMPTZ,
      start_time,
      '19:00:00'::TIME,
      late_threshold_minutes,
      2.5,
      3.5
    ) = 'late'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as test_late_status
FROM shift_tests;


-- Step 3: Check recent attendance for ALL shifts
-- ============================================================================
SELECT 
  '=== RECENT ATTENDANCE FOR ALL SHIFTS ===' as section;

SELECT 
  s.name as shift_name,
  COUNT(*) as total_checkins,
  SUM(CASE WHEN a.shift_id IS NULL THEN 1 ELSE 0 END) as missing_shift_id,
  SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as marked_late,
  SUM(CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 1 ELSE 0 
  END) as should_be_late,
  SUM(CASE 
    WHEN a.is_late != (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
      > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    )
    THEN 1 ELSE 0 
  END) as wrong_flags
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY s.created_at DESC;


-- Step 4: Check if employees have shifts assigned
-- ============================================================================
SELECT 
  '=== EMPLOYEE SHIFT ASSIGNMENTS ===' as section;

SELECT 
  s.name as shift_name,
  COUNT(DISTINCT es.user_id) as employees_assigned,
  MIN(es.effective_from) as earliest_assignment,
  MAX(es.effective_from) as latest_assignment
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.is_active = true
GROUP BY s.id, s.name
ORDER BY s.created_at DESC;


-- Step 5: Check attendance records without shift_id
-- ============================================================================
SELECT 
  '=== ATTENDANCE WITHOUT SHIFT_ID ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  a.check_in_time,
  a.shift_id,
  a.is_late,
  a.calculated_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '❌ NO SHIFT_ID - Late threshold CANNOT work'
    ELSE '✅ Has shift_id'
  END as issue
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date DESC, a.check_in_time DESC
LIMIT 20;


-- Step 6: ROOT CAUSE ANALYSIS
-- ============================================================================
SELECT 
  '=== ROOT CAUSE ANALYSIS ===' as section;

SELECT 
  CASE 
    -- Issue 1: Attendance records without shift_id
    WHEN EXISTS (
      SELECT 1 FROM attendance
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        AND check_in_time IS NOT NULL
        AND shift_id IS NULL
    )
    THEN '🔴 ISSUE 1: Attendance records exist WITHOUT shift_id
    
    WHY: When employee checks in, shift_id is not being stored
    
    IMPACT: Late threshold calculation IMPOSSIBLE without shift_id
    
    FIX: Need to ensure shift_id is always stored during check-in'
    
    -- Issue 2: Employees without shift assignments
    WHEN EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM employee_shifts es
          WHERE es.user_id = ep.user_id
            AND es.effective_from <= CURRENT_DATE
            AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
        )
    )
    THEN '🔴 ISSUE 2: Employees exist WITHOUT shift assignments
    
    WHY: New shifts created but employees not assigned
    
    IMPACT: get_employee_shift() returns NULL, check-in fails
    
    FIX: Assign shifts to all employees'
    
    -- Issue 3: Function not working
    WHEN EXISTS (
      SELECT 1 FROM (
        SELECT 
          calculate_attendance_status(
            (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
            '13:00:00'::TIME,
            '19:00:00'::TIME,
            15,
            2.5,
            3.5
          ) as result
      ) sub
      WHERE result != 'late'
    )
    THEN '🔴 ISSUE 3: calculate_attendance_status function NOT working
    
    WHY: Function logic has bug
    
    IMPACT: Even with shift_id, late detection fails
    
    FIX: Need to fix function logic'
    
    ELSE '✅ No obvious system-wide issues found
    
    Check individual shift details above'
  END as root_cause;


-- Step 7: Detailed breakdown
-- ============================================================================
SELECT 
  '=== ISSUE BREAKDOWN ===' as section;

-- Count attendance without shift_id
SELECT 
  'Attendance without shift_id (last 7 days)' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ CRITICAL' ELSE '✅ OK' END as status
FROM attendance
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND check_in_time IS NOT NULL
  AND shift_id IS NULL;

-- Count employees without shifts
SELECT 
  'Active employees without shift assignment' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ PROBLEM' ELSE '✅ OK' END as status
FROM employee_profiles ep
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM employee_shifts es
    WHERE es.user_id = ep.user_id
      AND es.effective_from <= CURRENT_DATE
      AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  );

-- Count wrong late flags
SELECT 
  'Attendance with wrong late flags (last 7 days)' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '⚠️ NEEDS FIX' ELSE '✅ OK' END as status
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
  AND a.is_late != (
    (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
    > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
  );


-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- If you see "Attendance without shift_id" > 0:
--   → This is the PRIMARY issue
--   → Late threshold CANNOT work without shift_id
--   → Need to backfill shift_id for existing records
--   → Need to ensure future check-ins store shift_id
--
-- If you see "Employees without shift assignment" > 0:
--   → New shifts created but not assigned
--   → Employees cannot check in properly
--   → Assign shifts to all employees
--
-- If you see "Wrong late flags" > 0:
--   → shift_id exists but flags are wrong
--   → Need to recalculate late flags
--   → Run fix script to update
-- ============================================================================
