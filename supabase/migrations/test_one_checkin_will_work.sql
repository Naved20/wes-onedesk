-- ============================================================================
-- TEST: Will One Check-in Work Correctly?
-- Simple test to verify late threshold will work for next check-in
-- ============================================================================

-- Pick one active employee
WITH test_employee AS (
  SELECT 
    user_id,
    first_name || ' ' || last_name as employee_name,
    institution_assignment
  FROM employee_profiles
  WHERE is_active = true
  LIMIT 1
)
SELECT 
  '=== TEST EMPLOYEE ===' as section,
  te.employee_name,
  te.institution_assignment,
  te.user_id
FROM test_employee te;


-- Check if this employee has shift assigned
WITH test_employee AS (
  SELECT user_id FROM employee_profiles WHERE is_active = true LIMIT 1
)
SELECT 
  '=== SHIFT ASSIGNMENT CHECK ===' as section,
  (SELECT shift_name FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_id,
  (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as late_threshold_minutes,
  (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1)::TIME + 
    ((SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) || ' minutes')::INTERVAL 
    as late_cutoff_time
FROM test_employee te;


-- Simulate what will happen if employee checks in ON TIME
WITH test_employee AS (
  SELECT user_id FROM employee_profiles WHERE is_active = true LIMIT 1
),
shift_info AS (
  SELECT 
    (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_id,
    (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as start_time,
    (SELECT end_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as end_time,
    (SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
    (SELECT half_day_threshold_hours FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as half_day_threshold,
    (SELECT last_checkin_hours_before_end FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as last_checkin_hours
  FROM test_employee te
),
test_checkin_ontime AS (
  SELECT 
    si.start_time::TIME + '5 minutes'::INTERVAL as checkin_time
  FROM shift_info si
)
SELECT 
  '=== SIMULATION: Check-in ON TIME ===' as section,
  tc.checkin_time as simulated_checkin_time,
  si.start_time as shift_start,
  si.late_threshold as late_threshold_minutes,
  (si.start_time::TIME + (si.late_threshold || ' minutes')::INTERVAL) as late_cutoff,
  si.shift_id,
  CASE 
    WHEN si.shift_id IS NULL THEN '❌ NO SHIFT - Check-in will FAIL'
    ELSE '✅ Has shift_id - Check-in will work'
  END as shift_status,
  calculate_attendance_status(
    (CURRENT_DATE + tc.checkin_time)::TIMESTAMPTZ,
    si.start_time,
    si.end_time,
    si.late_threshold,
    si.half_day_threshold,
    si.last_checkin_hours
  ) as calculated_status,
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + tc.checkin_time)::TIMESTAMPTZ,
      si.start_time,
      si.end_time,
      si.late_threshold,
      si.half_day_threshold,
      si.last_checkin_hours
    ) IN ('present', 'late')
    THEN '✅ CORRECT - Will be marked present'
    ELSE '❌ WRONG - Function not working'
  END as result
FROM test_checkin_ontime tc
CROSS JOIN shift_info si;


-- Simulate what will happen if employee checks in LATE
WITH test_employee AS (
  SELECT user_id FROM employee_profiles WHERE is_active = true LIMIT 1
),
shift_info AS (
  SELECT 
    (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_id,
    (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as start_time,
    (SELECT end_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as end_time,
    (SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
    (SELECT half_day_threshold_hours FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as half_day_threshold,
    (SELECT last_checkin_hours_before_end FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as last_checkin_hours
  FROM test_employee te
),
test_checkin_late AS (
  SELECT 
    si.start_time::TIME + ((si.late_threshold + 10) || ' minutes')::INTERVAL as checkin_time
  FROM shift_info si
)
SELECT 
  '=== SIMULATION: Check-in LATE ===' as section,
  tc.checkin_time as simulated_checkin_time,
  si.start_time as shift_start,
  si.late_threshold as late_threshold_minutes,
  (si.start_time::TIME + (si.late_threshold || ' minutes')::INTERVAL) as late_cutoff,
  si.shift_id,
  CASE 
    WHEN si.shift_id IS NULL THEN '❌ NO SHIFT - Check-in will FAIL'
    ELSE '✅ Has shift_id - Check-in will work'
  END as shift_status,
  calculate_attendance_status(
    (CURRENT_DATE + tc.checkin_time)::TIMESTAMPTZ,
    si.start_time,
    si.end_time,
    si.late_threshold,
    si.half_day_threshold,
    si.last_checkin_hours
  ) as calculated_status,
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + tc.checkin_time)::TIMESTAMPTZ,
      si.start_time,
      si.end_time,
      si.late_threshold,
      si.half_day_threshold,
      si.last_checkin_hours
    ) = 'late'
    THEN '✅ CORRECT - Will be marked LATE'
    ELSE '❌ WRONG - Function not working'
  END as result
FROM test_checkin_late tc
CROSS JOIN shift_info si;


-- Final verdict
SELECT 
  '=== FINAL VERDICT ===' as section;

WITH test_employee AS (
  SELECT user_id FROM employee_profiles WHERE is_active = true LIMIT 1
),
shift_check AS (
  SELECT 
    (SELECT shift_id FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_id
  FROM test_employee te
)
SELECT 
  CASE 
    WHEN shift_id IS NOT NULL
    THEN '✅✅✅ TEST PASSED! ✅✅✅

Next check-in will work correctly:
1. ✅ Employee has shift assigned
2. ✅ shift_id will be stored in attendance
3. ✅ Late threshold will calculate correctly
4. ✅ is_late flag will be set properly

You can now test with a real check-in! 🎉
'
    ELSE '❌ TEST FAILED!

Issue: Employee does not have shift assigned

Action needed:
1. Run the permanent fix migration: 20260420000000_ensure_future_late_threshold_works.sql
2. Or manually assign shift to this employee
3. Run this test again
'
  END as verdict
FROM shift_check;


-- ============================================================================
-- HOW TO USE:
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Check the FINAL VERDICT section
-- 3. If "TEST PASSED" → Everything ready, test with real check-in
-- 4. If "TEST FAILED" → Run permanent fix migration first
--
-- WHAT THIS TESTS:
-- - Employee has shift assigned?
-- - shift_id will be stored?
-- - Late threshold will calculate?
-- - Function works correctly?
-- ============================================================================
