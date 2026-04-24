-- ============================================================================
-- DIAGNOSE: Academy Shift Late Threshold Issue
-- Root cause analysis for why late threshold is not working
-- ============================================================================

-- Step 1: Check all Academy shifts configuration
-- ============================================================================
SELECT 
  '=== STEP 1: Academy Shift Configuration ===' as section;

SELECT 
  id,
  name,
  start_time,
  end_time,
  late_threshold_minutes,
  (start_time::TIME + (late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  half_day_threshold_hours,
  last_checkin_hours_before_end,
  is_active,
  created_at,
  updated_at
FROM shifts
WHERE name ILIKE '%academy%'
ORDER BY created_at DESC;


-- Step 2: Check employee shift assignments for Academy
-- ============================================================================
SELECT 
  '=== STEP 2: Employee Shift Assignments ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  es.effective_from,
  es.effective_to,
  CASE 
    WHEN es.effective_from <= CURRENT_DATE 
         AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    THEN '✅ Active'
    ELSE '❌ Not Active'
  END as assignment_status
FROM employee_shifts es
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON es.user_id = ep.user_id
WHERE s.name ILIKE '%academy%'
ORDER BY es.effective_from DESC, ep.first_name;


-- Step 3: Check recent Academy attendance records
-- ============================================================================
SELECT 
  '=== STEP 3: Recent Academy Attendance (Today) ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  a.is_late,
  a.calculated_status,
  a.shift_id,
  CASE 
    WHEN a.shift_id IS NULL THEN '❌ NO SHIFT ID'
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ Should be LATE'
    ELSE '✅ Should be ON TIME'
  END as correct_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '🔴 Missing shift_id'
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
LEFT JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date = CURRENT_DATE
  AND (s.name ILIKE '%academy%' OR ep.institution_assignment ILIKE '%academy%')
  AND a.check_in_time IS NOT NULL
ORDER BY a.check_in_time;


-- Step 4: Check if employees have correct shift assigned for today
-- ============================================================================
SELECT 
  '=== STEP 4: Shift Assignment Check for Today ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT start_time FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NULL
    THEN '❌ NO SHIFT ASSIGNED'
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) ILIKE '%academy%'
    THEN '✅ Academy shift assigned'
    ELSE '⚠️ Different shift: ' || (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1)
  END as status
FROM employee_profiles ep
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
ORDER BY ep.first_name;


-- Step 5: Check calculate_attendance_status function
-- ============================================================================
SELECT 
  '=== STEP 5: Test calculate_attendance_status Function ===' as section;

-- Test with Academy shift timings
WITH academy_shift AS (
  SELECT 
    start_time,
    end_time,
    late_threshold_minutes,
    half_day_threshold_hours,
    last_checkin_hours_before_end
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Test 1: 12:55 PM (Before shift)' as test_case,
  (CURRENT_DATE + '12:55:00'::TIME)::TIMESTAMPTZ as test_time,
  calculate_attendance_status(
    (CURRENT_DATE + '12:55:00'::TIME)::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as function_result,
  'Should be: present' as expected
FROM academy_shift a
UNION ALL
SELECT 
  'Test 2: 13:10 PM (Within threshold)',
  (CURRENT_DATE + '13:10:00'::TIME)::TIMESTAMPTZ,
  calculate_attendance_status(
    (CURRENT_DATE + '13:10:00'::TIME)::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ),
  'Should be: present'
FROM academy_shift a
UNION ALL
SELECT 
  'Test 3: 13:20 PM (After threshold)',
  (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
  calculate_attendance_status(
    (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ),
  'Should be: late'
FROM academy_shift a;


-- Step 6: Root Cause Analysis
-- ============================================================================
SELECT 
  '=== STEP 6: ROOT CAUSE ANALYSIS ===' as section;

SELECT 
  CASE 
    -- Check 1: Multiple Academy shifts
    WHEN (SELECT COUNT(*) FROM shifts WHERE name ILIKE '%academy%' AND is_active = true) > 1
    THEN '🔴 ISSUE 1: Multiple Academy shifts found - System may be confused about which one to use'
    
    -- Check 2: No shift assignments
    WHEN NOT EXISTS (
      SELECT 1 FROM employee_shifts es
      JOIN shifts s ON es.shift_id = s.id
      WHERE s.name ILIKE '%academy%'
        AND es.effective_from <= CURRENT_DATE
        AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    )
    THEN '🔴 ISSUE 2: No active shift assignments found for Academy shift'
    
    -- Check 3: Attendance records without shift_id
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN employee_profiles ep ON a.user_id = ep.user_id
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '7 days'
        AND a.shift_id IS NULL
    )
    THEN '🔴 ISSUE 3: Attendance records exist without shift_id - Late threshold cannot be calculated'
    
    -- Check 4: Wrong shift assigned
    WHEN EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND ep.is_active = true
        AND (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) NOT ILIKE '%academy%'
    )
    THEN '🔴 ISSUE 4: Academy employees have wrong shift assigned'
    
    ELSE '✅ No obvious issues found - Check detailed steps above'
  END as root_cause;


-- Step 7: Detailed breakdown of issues
-- ============================================================================
SELECT 
  '=== STEP 7: Issue Breakdown ===' as section;

-- Count multiple shifts
SELECT 
  'Multiple Academy Shifts' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 1 THEN '❌ Problem' ELSE '✅ OK' END as status
FROM shifts
WHERE name ILIKE '%academy%' AND is_active = true;

-- Count employees without shift
SELECT 
  'Academy Employees Without Shift' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ Problem' ELSE '✅ OK' END as status
FROM employee_profiles ep
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
  );

-- Count attendance without shift_id
SELECT 
  'Attendance Records Without shift_id' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ Problem' ELSE '✅ OK' END as status
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.shift_id IS NULL;


-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- 🔴 ISSUE 1: Multiple Academy shifts
--    → Delete old Academy shift, keep only the new one
--
-- 🔴 ISSUE 2: No active shift assignments
--    → Assign the new Academy shift to all Academy employees
--
-- 🔴 ISSUE 3: Attendance without shift_id
--    → Old attendance records don't have shift_id
--    → Need to backfill shift_id for existing records
--
-- 🔴 ISSUE 4: Wrong shift assigned
--    → Employees have old shift assigned
--    → Need to update shift assignments
-- ============================================================================
