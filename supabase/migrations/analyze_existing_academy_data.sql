-- ============================================================================
-- ANALYZE EXISTING ACADEMY DATA
-- Find the problem without needing fresh check-ins
-- ============================================================================

-- Step 1: Academy shift configuration analysis
-- ============================================================================
SELECT 
  '=== ACADEMY SHIFT CONFIGURATION ===' as section;

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
  CASE 
    WHEN late_threshold_minutes = 0 OR late_threshold_minutes IS NULL 
    THEN '🔴 PROBLEM: Late threshold is 0 or NULL'
    WHEN late_threshold_minutes < 5 
    THEN '⚠️ WARNING: Very low late threshold (' || late_threshold_minutes || ' min)'
    WHEN late_threshold_minutes > 30 
    THEN '⚠️ WARNING: Very high late threshold (' || late_threshold_minutes || ' min)'
    ELSE '✅ Late threshold looks reasonable (' || late_threshold_minutes || ' min)'
  END as threshold_analysis
FROM shifts
WHERE name ILIKE '%academy%'
ORDER BY created_at DESC;


-- Step 2: Academy employee shift assignments
-- ============================================================================
SELECT 
  '=== ACADEMY EMPLOYEE ASSIGNMENTS ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  es.effective_from,
  es.effective_to,
  s.name as assigned_shift,
  s.start_time,
  s.late_threshold_minutes,
  CASE 
    WHEN es.effective_from > CURRENT_DATE 
    THEN '⚠️ Future assignment (not active yet)'
    WHEN es.effective_to IS NOT NULL AND es.effective_to < CURRENT_DATE 
    THEN '❌ Expired assignment'
    WHEN s.is_active = false 
    THEN '❌ Assigned to inactive shift'
    ELSE '✅ Active assignment'
  END as assignment_status
FROM employee_profiles ep
LEFT JOIN employee_shifts es ON ep.user_id = es.user_id 
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
LEFT JOIN shifts s ON es.shift_id = s.id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND ep.is_active = true
ORDER BY ep.first_name;


-- Step 3: Recent Academy attendance analysis (last 7 days)
-- ============================================================================
SELECT 
  '=== RECENT ACADEMY ATTENDANCE (Last 7 days) ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  
  -- Time analysis
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only,
  
  -- Shift details
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  
  -- Current flags
  a.shift_id,
  a.is_late,
  a.calculated_status,
  
  -- Mathematical analysis
  ROUND(
    EXTRACT(EPOCH FROM (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME - s.start_time::TIME
    ))/60
  ) as minutes_after_start,
  
  -- What should it be?
  CASE 
    WHEN a.shift_id IS NULL THEN 'CANNOT_CALCULATE (No shift_id)'
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'SHOULD_BE_LATE'
    ELSE 'SHOULD_BE_ON_TIME'
  END as mathematical_result,
  
  -- Accuracy check
  CASE 
    WHEN a.shift_id IS NULL THEN '🔴 NO_SHIFT_ID'
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT_LATE'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT_ON_TIME'
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ WRONG_MARKED_LATE'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '❌ WRONG_MARKED_ON_TIME'
    ELSE '❓ UNKNOWN'
  END as accuracy

FROM attendance a
LEFT JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date DESC, a.check_in_time DESC;


-- Step 4: Problem pattern analysis
-- ============================================================================
SELECT 
  '=== PROBLEM PATTERN ANALYSIS ===' as section;

WITH academy_attendance AS (
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
    AND a.date >= CURRENT_DATE - INTERVAL '7 days'
    AND a.check_in_time IS NOT NULL
)
SELECT 
  'Total Academy check-ins (last 7 days)' as metric,
  COUNT(*) as count,
  '' as analysis
FROM academy_attendance
UNION ALL
SELECT 
  'Check-ins with NULL shift_id',
  COUNT(*),
  CASE WHEN COUNT(*) > 0 THEN '🔴 CRITICAL ISSUE' ELSE '✅ OK' END
FROM academy_attendance
WHERE shift_id IS NULL
UNION ALL
SELECT 
  'Check-ins with wrong late flags',
  COUNT(*),
  CASE WHEN COUNT(*) > 0 THEN '❌ CALCULATION ISSUE' ELSE '✅ OK' END
FROM academy_attendance
WHERE shift_id IS NOT NULL AND is_late != should_be_late
UNION ALL
SELECT 
  'Check-ins marked late incorrectly',
  COUNT(*),
  CASE WHEN COUNT(*) > 0 THEN '❌ FALSE POSITIVES' ELSE '✅ OK' END
FROM academy_attendance
WHERE shift_id IS NOT NULL AND is_late = true AND should_be_late = false
UNION ALL
SELECT 
  'Check-ins marked on-time incorrectly',
  COUNT(*),
  CASE WHEN COUNT(*) > 0 THEN '❌ FALSE NEGATIVES' ELSE '✅ OK' END
FROM academy_attendance
WHERE shift_id IS NOT NULL AND is_late = false AND should_be_late = true;


-- Step 5: Function testing with Academy shift parameters
-- ============================================================================
SELECT 
  '=== FUNCTION TESTING ===' as section;

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
  'Function Test Results' as test_category,
  
  -- Test 1: On time check-in
  'Test 1: Check-in 5 min after start (should be ON TIME if threshold > 5)' as test_1_desc,
  calculate_attendance_status(
    (CURRENT_DATE + (a.start_time::TIME + '5 minutes'::INTERVAL))::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as test_1_result,
  CASE 
    WHEN a.late_threshold_minutes > 5 THEN 'Expected: present'
    ELSE 'Expected: late'
  END as test_1_expected,
  
  -- Test 2: Late check-in
  'Test 2: Check-in after late threshold (should be LATE)' as test_2_desc,
  calculate_attendance_status(
    (CURRENT_DATE + (a.start_time::TIME + ((a.late_threshold_minutes + 5) || ' minutes')::INTERVAL))::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as test_2_result,
  'Expected: late' as test_2_expected

FROM academy_shift a;


-- Step 6: ROOT CAUSE IDENTIFICATION
-- ============================================================================
SELECT 
  '=== ROOT CAUSE IDENTIFICATION ===' as section;

WITH analysis AS (
  SELECT 
    -- Count total Academy check-ins
    (SELECT COUNT(*) FROM attendance a
     JOIN employee_profiles ep ON a.user_id = ep.user_id
     WHERE ep.institution_assignment ILIKE '%academy%'
       AND a.date >= CURRENT_DATE - INTERVAL '7 days'
       AND a.check_in_time IS NOT NULL) as total_checkins,
    
    -- Count NULL shift_id
    (SELECT COUNT(*) FROM attendance a
     JOIN employee_profiles ep ON a.user_id = ep.user_id
     WHERE ep.institution_assignment ILIKE '%academy%'
       AND a.date >= CURRENT_DATE - INTERVAL '7 days'
       AND a.check_in_time IS NOT NULL
       AND a.shift_id IS NULL) as null_shift_id_count,
    
    -- Count wrong flags
    (SELECT COUNT(*) FROM attendance a
     LEFT JOIN shifts s ON a.shift_id = s.id
     JOIN employee_profiles ep ON a.user_id = ep.user_id
     WHERE ep.institution_assignment ILIKE '%academy%'
       AND a.date >= CURRENT_DATE - INTERVAL '7 days'
       AND a.check_in_time IS NOT NULL
       AND a.shift_id IS NOT NULL
       AND a.is_late != (
         (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
       )) as wrong_flags_count,
    
    -- Check if Academy shift has proper threshold
    (SELECT COUNT(*) FROM shifts 
     WHERE name ILIKE '%academy%' 
       AND is_active = true 
       AND (late_threshold_minutes IS NULL OR late_threshold_minutes = 0)) as bad_threshold_count,
    
    -- Check function result
    (SELECT 
       CASE WHEN calculate_attendance_status(
         (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
         '13:00:00'::TIME,
         '19:00:00'::TIME,
         15,
         2.5,
         3.5
       ) = 'late' THEN 0 ELSE 1 END
    ) as function_broken
)
SELECT 
  CASE 
    WHEN total_checkins = 0 THEN 
      '📋 NO ACADEMY CHECK-INS IN LAST 7 DAYS
      
ANALYSIS: No recent data to analyze
RECOMMENDATION: 
1. Check if Academy employees are actually using the system
2. Look at older data (change INTERVAL to 30 days)
3. Or ask for one fresh check-in to test'
    
    WHEN bad_threshold_count > 0 THEN 
      '🔴 ROOT CAUSE: ACADEMY SHIFT HAS BAD LATE THRESHOLD
      
PROBLEM: Academy shift late_threshold_minutes is 0 or NULL
IMPACT: Late threshold cannot work with 0 threshold
SOLUTION: 
1. Go to Shift Management page
2. Edit Academy shift
3. Set late_threshold_minutes to 15 (or desired value)
4. Save changes'
    
    WHEN function_broken = 1 THEN 
      '🔴 ROOT CAUSE: calculate_attendance_status FUNCTION IS BROKEN
      
PROBLEM: Function not returning correct results
IMPACT: Even with correct shift_id, late calculation fails
SOLUTION: Function needs to be recreated/fixed'
    
    WHEN null_shift_id_count = total_checkins THEN 
      '🔴 ROOT CAUSE: ALL ACADEMY ATTENDANCE HAS NULL shift_id
      
PROBLEM: No Academy attendance records have shift_id
CAUSE: Employees not assigned to Academy shift OR triggers not working
SOLUTION: 
1. Run permanent fix migration: 20260420000000_ensure_future_late_threshold_works.sql
2. This will assign shifts and add triggers'
    
    WHEN null_shift_id_count > 0 AND null_shift_id_count < total_checkins THEN 
      '🔴 ROOT CAUSE: SOME ACADEMY ATTENDANCE HAS NULL shift_id
      
PROBLEM: ' || null_shift_id_count || ' out of ' || total_checkins || ' records have NULL shift_id
CAUSE: Partial shift assignments or triggers not working consistently
SOLUTION: Run permanent fix migration'
    
    WHEN wrong_flags_count = total_checkins THEN 
      '🔴 ROOT CAUSE: ALL ACADEMY LATE FLAGS ARE WRONG
      
PROBLEM: All ' || total_checkins || ' records have incorrect is_late flags
CAUSE: Timezone issue, function issue, or calculation bug
SOLUTION: Need to debug calculation logic'
    
    WHEN wrong_flags_count > 0 THEN 
      '⚠️ ROOT CAUSE: SOME ACADEMY LATE FLAGS ARE WRONG
      
PROBLEM: ' || wrong_flags_count || ' out of ' || total_checkins || ' records have wrong flags
CAUSE: Mixed issues - some records calculated correctly, others not
SOLUTION: Check if wrong records are older (before fix) or recent'
    
    ELSE 
      '✅ NO OBVIOUS ISSUES FOUND
      
ANALYSIS: 
- Total check-ins: ' || total_checkins || '
- NULL shift_id: ' || null_shift_id_count || '
- Wrong flags: ' || wrong_flags_count || '
- Function working: Yes
- Threshold configured: Yes

POSSIBLE CAUSES:
1. You are looking at very old records (before system was fixed)
2. Issue is with specific employees or specific dates
3. Problem is intermittent

RECOMMENDATION: Look at "RECENT ACADEMY ATTENDANCE" section above for specific examples'
  END as root_cause_analysis

FROM analysis;


-- ============================================================================
-- SUMMARY:
-- This script analyzes existing Academy data to find the root cause
-- Focus on "ROOT CAUSE IDENTIFICATION" section for the main issue
-- Check "RECENT ACADEMY ATTENDANCE" for specific examples
-- No fresh check-ins needed - uses existing data
-- ============================================================================