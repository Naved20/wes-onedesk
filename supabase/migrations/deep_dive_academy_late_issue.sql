-- ============================================================================
-- DEEP DIVE: Academy Late Threshold Issue
-- System shows healthy but late threshold still not working
-- ============================================================================

-- Step 1: Show recent Academy check-ins with detailed analysis
-- ============================================================================
SELECT 
  '=== RECENT ACADEMY CHECK-INS (Last 2 days) ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  -- Check-in times
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  
  -- Shift details
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  
  -- Current flags
  a.shift_id,
  a.is_late as currently_marked,
  a.calculated_status,
  
  -- What it SHOULD be
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'LATE'
    ELSE 'ON TIME'
  END as should_be,
  
  -- Is it correct?
  CASE 
    WHEN a.shift_id IS NULL THEN '🔴 NO SHIFT_ID'
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT (Late)'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT (On Time)'
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ WRONG (Marked Late but was On Time)'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ WRONG (Marked On Time but was Late)'
    ELSE '❓ UNKNOWN'
  END as accuracy_check,
  
  -- Time difference analysis
  EXTRACT(EPOCH FROM (
    (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME - s.start_time::TIME
  ))/60 as minutes_after_shift_start,
  
  CASE 
    WHEN EXTRACT(EPOCH FROM (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME - s.start_time::TIME
    ))/60 > s.late_threshold_minutes
    THEN '❌ LATE (' || ROUND(EXTRACT(EPOCH FROM (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME - s.start_time::TIME
    ))/60) || ' min after start, threshold: ' || s.late_threshold_minutes || ' min)'
    ELSE '✅ ON TIME (' || ROUND(EXTRACT(EPOCH FROM (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME - s.start_time::TIME
    ))/60) || ' min after start, threshold: ' || s.late_threshold_minutes || ' min)'
  END as detailed_analysis

FROM attendance a
LEFT JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '2 days'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date DESC, a.check_in_time DESC;


-- Step 2: Test calculate_attendance_status function with Academy shift
-- ============================================================================
SELECT 
  '=== FUNCTION TEST WITH ACADEMY SHIFT ===' as section;

WITH academy_shift AS (
  SELECT 
    name,
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
  'Academy Shift: ' || a.name as shift_info,
  'Start: ' || a.start_time || ', Late Threshold: ' || a.late_threshold_minutes || ' min' as timing_info,
  
  -- Test 1: Check-in exactly at start time
  'Test 1: Check-in at start time (' || a.start_time || ')' as test_1_desc,
  calculate_attendance_status(
    (CURRENT_DATE + a.start_time)::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as test_1_result,
  'Should be: present' as test_1_expected,
  
  -- Test 2: Check-in 5 minutes after start (within threshold)
  'Test 2: Check-in 5 min after start' as test_2_desc,
  calculate_attendance_status(
    (CURRENT_DATE + (a.start_time::TIME + '5 minutes'::INTERVAL))::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as test_2_result,
  CASE 
    WHEN a.late_threshold_minutes > 5 THEN 'Should be: present'
    ELSE 'Should be: late'
  END as test_2_expected,
  
  -- Test 3: Check-in after late threshold
  'Test 3: Check-in ' || (a.late_threshold_minutes + 5) || ' min after start (LATE)' as test_3_desc,
  calculate_attendance_status(
    (CURRENT_DATE + (a.start_time::TIME + ((a.late_threshold_minutes + 5) || ' minutes')::INTERVAL))::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as test_3_result,
  'Should be: late' as test_3_expected

FROM academy_shift a;


-- Step 3: Check if triggers are working
-- ============================================================================
SELECT 
  '=== TRIGGER STATUS ===' as section;

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


-- Step 4: Specific problem identification
-- ============================================================================
SELECT 
  '=== PROBLEM IDENTIFICATION ===' as section;

WITH recent_academy_attendance AS (
  SELECT 
    a.*,
    s.start_time,
    s.late_threshold_minutes,
    (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_time_ist,
    CASE 
      WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
           > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
      THEN true
      ELSE false
    END as should_be_late
  FROM attendance a
  LEFT JOIN shifts s ON a.shift_id = s.id
  JOIN employee_profiles ep ON a.user_id = ep.user_id
  WHERE ep.institution_assignment ILIKE '%academy%'
    AND a.date >= CURRENT_DATE - INTERVAL '2 days'
    AND a.check_in_time IS NOT NULL
)
SELECT 
  CASE 
    -- Problem 1: Function not working
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
    THEN '🔴 PROBLEM 1: calculate_attendance_status function is NOT working

ISSUE: Function should return "late" for 13:20 check-in with 13:00 start + 15min threshold
IMPACT: Even with correct shift_id, late detection fails
SOLUTION: Function needs to be fixed or recreated'
    
    -- Problem 2: Wrong timezone handling
    WHEN EXISTS (
      SELECT 1 FROM recent_academy_attendance
      WHERE shift_id IS NOT NULL
        AND is_late != should_be_late
    )
    THEN '🔴 PROBLEM 2: Timezone or calculation issue

ISSUE: shift_id exists but is_late flag is wrong
POSSIBLE CAUSES:
1. Timezone conversion issue (UTC vs IST)
2. Function called with wrong parameters
3. Old records calculated before fix

SOLUTION: 
1. Check if recent check-ins (today) are correct
2. If old records wrong, ignore them
3. If new records wrong, function needs fix'
    
    -- Problem 3: Shift configuration issue
    WHEN NOT EXISTS (
      SELECT 1 FROM shifts 
      WHERE name ILIKE '%academy%' 
        AND is_active = true 
        AND late_threshold_minutes > 0
    )
    THEN '🔴 PROBLEM 3: Academy shift configuration issue

ISSUE: Academy shift not properly configured
CHECK: late_threshold_minutes should be > 0
SOLUTION: Edit Academy shift and set proper late threshold'
    
    -- Problem 4: Check-in process issue
    WHEN EXISTS (
      SELECT 1 FROM recent_academy_attendance
      WHERE shift_id IS NULL
    )
    THEN '🔴 PROBLEM 4: Check-in process not storing shift_id

ISSUE: Recent check-ins still have NULL shift_id
CAUSE: Triggers not working or check-in code bypassing them
SOLUTION: Run permanent fix migration'
    
    ELSE '✅ No obvious technical issues found

POSSIBLE CAUSES:
1. You are looking at OLD attendance records (before fix)
2. Specific employee has different shift assigned
3. Check-in time vs shift time mismatch

NEXT STEPS:
1. Test with ONE fresh check-in today
2. Check that specific attendance record
3. Verify employee has correct Academy shift'
  END as problem_analysis;


-- Step 5: TODAY'S CHECK-INS ONLY (Most Important)
-- ============================================================================
SELECT 
  '=== TODAY''S ACADEMY CHECK-INS ONLY ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_time_ist,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.is_late as marked_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as should_be,
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
  END as accuracy
FROM attendance a
LEFT JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
ORDER BY a.check_in_time DESC;


-- Step 6: FINAL RECOMMENDATION
-- ============================================================================
SELECT 
  '=== FINAL RECOMMENDATION ===' as section;

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM attendance a
      JOIN employee_profiles ep ON a.user_id = ep.user_id
      WHERE ep.institution_assignment ILIKE '%academy%'
        AND a.date = CURRENT_DATE
        AND a.check_in_time IS NOT NULL
    )
    THEN '📋 NO TODAY''S CHECK-INS FOUND

RECOMMENDATION:
1. Ask ONE Academy employee to check-in RIGHT NOW
2. Note the exact time they check-in
3. Check if they are marked late/on-time correctly
4. Run this script again to see today''s results

This will tell us if the system is working for NEW check-ins.'
    
    ELSE '📊 CHECK TODAY''S RESULTS ABOVE

Look at "TODAY''S ACADEMY CHECK-INS ONLY" section:
- If accuracy shows ✅ CORRECT → System is working, old records were wrong
- If accuracy shows ❌ WRONG → We have a real problem to fix

NEXT STEPS:
1. Check accuracy column above
2. If WRONG, tell me the exact details
3. If CORRECT, ignore old wrong records'
  END as final_recommendation;


-- ============================================================================
-- SUMMARY:
-- This script will show you EXACTLY what's happening with Academy late threshold
-- Focus on "TODAY'S ACADEMY CHECK-INS ONLY" section - that's the real test
-- If no today's check-ins, ask someone to check-in and run again
-- ============================================================================