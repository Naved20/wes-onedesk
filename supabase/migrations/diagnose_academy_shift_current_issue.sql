-- ============================================================================
-- DIAGNOSE: Current Academy Shift Issue
-- Check why Academy shift late threshold is not working
-- ============================================================================

-- Step 1: Check Academy shift configuration
-- ============================================================================
SELECT 
  '=== STEP 1: Academy Shift Details ===' as section;

SELECT 
  id,
  name,
  start_time,
  end_time,
  late_threshold_minutes,
  (start_time::TIME + (late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  is_active,
  created_at
FROM shifts
WHERE name ILIKE '%academy%'
ORDER BY created_at DESC;


-- Step 2: Check if Academy employees have shift assigned
-- ============================================================================
SELECT 
  '=== STEP 2: Academy Employees Shift Assignment ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT shift_id FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_id,
  (SELECT start_time FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_id FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '✅ Has shift assigned'
    ELSE '❌ NO SHIFT ASSIGNED'
  END as status
FROM employee_profiles ep
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
ORDER BY ep.first_name;


-- Step 3: Check recent Academy attendance records
-- ============================================================================
SELECT 
  '=== STEP 3: Recent Academy Attendance ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.shift_id,
  a.is_late as marked_late,
  a.calculated_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '🔴 NO SHIFT_ID - Cannot calculate late threshold'
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ Should be LATE but may be marked wrong'
    ELSE '✅ Should be ON TIME'
  END as correct_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '🔴 Missing shift_id - PRIMARY ISSUE'
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT'
    ELSE '❌ WRONG - Late flag is incorrect'
  END as verification
FROM attendance a
LEFT JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '3 days'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date DESC, a.check_in_time DESC;


-- Step 4: Count issues
-- ============================================================================
SELECT 
  '=== STEP 4: Issue Summary ===' as section;

-- Count Academy employees without shift
SELECT 
  'Academy employees without shift' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ PROBLEM' ELSE '✅ OK' END as status
FROM employee_profiles ep
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
  );

-- Count Academy attendance without shift_id
SELECT 
  'Academy attendance without shift_id (last 3 days)' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '❌ PROBLEM' ELSE '✅ OK' END as status
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '3 days'
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NULL;

-- Count Academy attendance with wrong late flags
SELECT 
  'Academy attendance with wrong late flags (last 3 days)' as issue_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '⚠️ NEEDS FIX' ELSE '✅ OK' END as status
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '3 days'
  AND a.check_in_time IS NOT NULL
  AND a.is_late != (
    (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
    > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
  );


-- Step 5: ROOT CAUSE ANALYSIS
-- ============================================================================
SELECT 
  '=== STEP 5: ROOT CAUSE ===' as section;

SELECT 
  CASE 
    -- Issue 1: Employees don't have Academy shift assigned
    WHEN EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND ep.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
        )
    )
    THEN '🔴 ROOT CAUSE 1: Academy employees do NOT have shift assigned

PROBLEM: You created Academy shift but forgot to assign it to employees
IMPACT: get_employee_shift() returns NULL → shift_id = NULL → Late threshold FAILS
SOLUTION: Go to Employee Shift Assignment page and assign Academy shift to all Academy employees

QUICK FIX:
1. Open Employee Shift Assignment page
2. Filter by "No Shift" 
3. Select all Academy employees
4. Bulk assign them to Academy shift
5. Set effective_from = today
6. Done!'
    
    -- Issue 2: Attendance records have NULL shift_id
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN employee_profiles ep ON a.user_id = ep.user_id
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '3 days'
        AND a.check_in_time IS NOT NULL
        AND a.shift_id IS NULL
    )
    THEN '🔴 ROOT CAUSE 2: Academy attendance records have NULL shift_id

PROBLEM: Employees were assigned shift AFTER they checked in, so old records have NULL shift_id
IMPACT: Old attendance records cannot calculate late threshold
SOLUTION: Run permanent fix migration to add triggers for future + fix existing records

STEPS:
1. Run: 20260420000000_ensure_future_late_threshold_works.sql
2. This will fix future check-ins automatically
3. Old records may need manual correction'
    
    -- Issue 3: Wrong late flags
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN shifts s ON a.shift_id = s.id
      JOIN employee_profiles ep ON a.user_id = ep.user_id
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '3 days'
        AND a.check_in_time IS NOT NULL
        AND a.is_late != (
          (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
          > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
        )
    )
    THEN '🔴 ROOT CAUSE 3: Academy attendance has wrong late flags

PROBLEM: shift_id exists but is_late flag is calculated wrong
IMPACT: Employees marked late when they are on time (or vice versa)
SOLUTION: Recalculate late flags for existing records

STEPS:
1. Run late flag correction script
2. Update is_late based on actual check-in time vs late threshold'
    
    ELSE '✅ No obvious issues found - Check detailed steps above for specific problems'
  END as root_cause_analysis;


-- Step 6: IMMEDIATE ACTION NEEDED
-- ============================================================================
SELECT 
  '=== STEP 6: IMMEDIATE ACTION ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND ep.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
        )
    )
    THEN '🚨 URGENT: Academy employees need shift assignment

ACTION REQUIRED:
1. Open Employee Shift Assignment page
2. Search for Academy employees
3. Select all Academy employees (use checkboxes)
4. Click "Bulk Assign"
5. Select your Academy shift
6. Set effective_from = today
7. Click "Assign to X employees"

This will fix the issue immediately!'
    
    WHEN EXISTS (
      SELECT 1 FROM attendance a
      JOIN employee_profiles ep ON a.user_id = ep.user_id
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND a.date >= CURRENT_DATE - INTERVAL '1 day'
        AND a.check_in_time IS NOT NULL
        AND a.shift_id IS NULL
    )
    THEN '🚨 URGENT: Recent Academy attendance has NULL shift_id

ACTION REQUIRED:
1. Run permanent fix migration: 20260420000000_ensure_future_late_threshold_works.sql
2. This will add triggers to prevent future issues
3. Test with one Academy employee check-in
4. Verify shift_id is stored correctly'
    
    ELSE '✅ System looks healthy - Run detailed verification'
  END as immediate_action;


-- ============================================================================
-- HOW TO USE THIS SCRIPT:
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Check STEP 5: ROOT CAUSE for the main issue
-- 3. Check STEP 6: IMMEDIATE ACTION for what to do
-- 4. Follow the recommended steps
-- 5. Test with one Academy employee check-in
-- 6. Run verification script to confirm fix
-- ============================================================================