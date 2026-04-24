-- ============================================================================
-- VERIFY: Permanent Fix is Working for Future Check-ins
-- Run this to confirm everything will work correctly from now onwards
-- ============================================================================

-- Step 1: Check ALL employees have shift assignments
-- ============================================================================
SELECT 
  '=== STEP 1: All Employees Have Shifts? ===' as section;

SELECT 
  ep.institution_assignment,
  COUNT(*) as total_employees,
  SUM(CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL 
    THEN 1 ELSE 0 
  END) as with_shift,
  SUM(CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NULL 
    THEN 1 ELSE 0 
  END) as without_shift,
  CASE 
    WHEN SUM(CASE 
      WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NULL 
      THEN 1 ELSE 0 
    END) = 0
    THEN '✅ ALL HAVE SHIFTS'
    ELSE '❌ ' || SUM(CASE 
      WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NULL 
      THEN 1 ELSE 0 
    END)::TEXT || ' employees need shift'
  END as status
FROM employee_profiles ep
WHERE ep.is_active = true
GROUP BY ep.institution_assignment
ORDER BY ep.institution_assignment;


-- Step 2: Check triggers are active
-- ============================================================================
SELECT 
  '=== STEP 2: Triggers Active? ===' as section;

SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ACTIVE'
    ELSE '❌ DISABLED'
  END as status
FROM pg_trigger
WHERE tgname IN ('trigger_auto_assign_shift', 'trigger_validate_attendance_shift')
ORDER BY tgname;


-- Step 3: Test what will happen on next check-in
-- ============================================================================
SELECT 
  '=== STEP 3: Simulate Next Check-in ===' as section;

-- Pick one employee from each institution
WITH test_employees AS (
  SELECT DISTINCT ON (institution_assignment)
    user_id,
    first_name || ' ' || last_name as employee_name,
    institution_assignment
  FROM employee_profiles
  WHERE is_active = true
  ORDER BY institution_assignment, user_id
)
SELECT 
  te.employee_name,
  te.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_id,
  (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '✅ Check-in will work - shift_id will be stored'
    ELSE '❌ Check-in will FAIL - no shift assigned'
  END as future_checkin_status
FROM test_employees te
ORDER BY te.institution_assignment;


-- Step 4: Verify late threshold calculation will work
-- ============================================================================
SELECT 
  '=== STEP 4: Late Threshold Will Work? ===' as section;

-- Test with actual shift timings
WITH shift_tests AS (
  SELECT 
    s.name as shift_name,
    s.start_time,
    s.late_threshold_minutes,
    (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
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
  test_time_late,
  calculate_attendance_status(
    (CURRENT_DATE + test_time_late)::TIMESTAMPTZ,
    start_time,
    '19:00:00'::TIME,
    late_threshold_minutes,
    2.5,
    3.5
  ) as function_result,
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + test_time_late)::TIMESTAMPTZ,
      start_time,
      '19:00:00'::TIME,
      late_threshold_minutes,
      2.5,
      3.5
    ) = 'late'
    THEN '✅ WILL WORK - Late detected correctly'
    ELSE '❌ PROBLEM - Function not working'
  END as status
FROM shift_tests;


-- Step 5: Check if new employee will get shift automatically
-- ============================================================================
SELECT 
  '=== STEP 5: New Employee Auto-Assignment Test ===' as section;

SELECT 
  'trigger_auto_assign_shift' as trigger_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_auto_assign_shift' 
        AND tgenabled = 'O'
    )
    THEN '✅ ACTIVE - New employees will auto-get shifts'
    ELSE '❌ MISSING - New employees will NOT get shifts'
  END as status;


-- Step 6: Check if attendance will always have shift_id
-- ============================================================================
SELECT 
  '=== STEP 6: Attendance shift_id Validation Test ===' as section;

SELECT 
  'trigger_validate_attendance_shift' as trigger_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_validate_attendance_shift' 
        AND tgenabled = 'O'
    )
    THEN '✅ ACTIVE - Attendance will always have shift_id'
    ELSE '❌ MISSING - Attendance may have NULL shift_id'
  END as status;


-- Step 7: Overall System Health Check
-- ============================================================================
SELECT 
  '=== STEP 7: Overall System Health ===' as section;

WITH health_checks AS (
  -- Check 1: All employees have shifts
  SELECT 
    'All employees have shifts' as check_name,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM employee_profiles ep
        WHERE ep.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
          )
      )
      THEN true ELSE false
    END as passed
  
  UNION ALL
  
  -- Check 2: Auto-assign trigger exists
  SELECT 
    'Auto-assign trigger active',
    EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_auto_assign_shift' AND tgenabled = 'O'
    )
  
  UNION ALL
  
  -- Check 3: Validate shift trigger exists
  SELECT 
    'Validate shift trigger active',
    EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_validate_attendance_shift' AND tgenabled = 'O'
    )
  
  UNION ALL
  
  -- Check 4: All shifts have late threshold
  SELECT 
    'All shifts have late threshold',
    NOT EXISTS (
      SELECT 1 FROM shifts 
      WHERE is_active = true 
        AND (late_threshold_minutes IS NULL OR late_threshold_minutes = 0)
    )
  
  UNION ALL
  
  -- Check 5: Function works correctly
  SELECT 
    'calculate_attendance_status works',
    calculate_attendance_status(
      (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
      '13:00:00'::TIME,
      '19:00:00'::TIME,
      15,
      2.5,
      3.5
    ) = 'late'
)
SELECT 
  check_name,
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM health_checks;


-- Step 8: FINAL VERDICT
-- ============================================================================
SELECT 
  '=== FINAL VERDICT ===' as section;

SELECT 
  CASE 
    -- All checks must pass
    WHEN NOT EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_auto_assign_shift' AND tgenabled = 'O'
    )
    AND EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'trigger_validate_attendance_shift' AND tgenabled = 'O'
    )
    AND calculate_attendance_status(
      (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
      '13:00:00'::TIME,
      '19:00:00'::TIME,
      15,
      2.5,
      3.5
    ) = 'late'
    THEN '✅✅✅ SUCCESS! FUTURE LATE THRESHOLD WILL WORK! ✅✅✅

🎉 System is ready! From now onwards:

1. ✅ All employees have shifts assigned
2. ✅ New employees will auto-get shifts
3. ✅ Check-ins will auto-store shift_id
4. ✅ Late threshold will calculate correctly

You can now:
- Create new shifts → Assign to employees → Works immediately
- Add new employees → Auto-assigned shift → Can check-in
- Employees check-in → shift_id stored → Late threshold works

NO MORE MANUAL FIXES NEEDED! 🚀
'
    ELSE '⚠️ SOME ISSUES FOUND - Check steps above for details

Issues to fix:
' || 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM employee_profiles ep
        WHERE ep.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
          )
      )
      THEN '❌ Some employees still need shift assignment
'
      ELSE ''
    END ||
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_auto_assign_shift' AND tgenabled = 'O'
      )
      THEN '❌ Auto-assign trigger not active
'
      ELSE ''
    END ||
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_validate_attendance_shift' AND tgenabled = 'O'
      )
      THEN '❌ Validate shift trigger not active
'
      ELSE ''
    END
  END as verdict;


-- Step 9: Employees without shifts (if any)
-- ============================================================================
SELECT 
  '=== STEP 9: Employees Without Shifts (if any) ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  ep.email,
  '❌ NO SHIFT ASSIGNED' as issue,
  'Manually assign shift to this employee' as action_needed
FROM employee_profiles ep
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
  )
ORDER BY ep.institution_assignment, ep.first_name;


-- ============================================================================
-- HOW TO USE THIS SCRIPT:
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Check STEP 8: FINAL VERDICT
-- 3. If you see "SUCCESS!" → Everything is ready!
-- 4. If you see "SOME ISSUES" → Check STEP 9 for employees without shifts
-- 5. Manually assign shifts to those employees
-- 6. Run this script again to verify
--
-- WHAT TO EXPECT:
-- - All employees should have shifts
-- - Both triggers should be active
-- - Function should work correctly
-- - Future check-ins will work perfectly
-- ============================================================================
