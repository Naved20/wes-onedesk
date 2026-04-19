-- ============================================================================
-- COMPREHENSIVE VERIFICATION: Check if shifts are working correctly now
-- Run this in Supabase SQL Editor after assigning shifts
-- ============================================================================

-- Step 1: Check all employees have active shift assignments
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as assigned_shift,
  s.start_time,
  s.end_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  es.effective_from,
  es.effective_to,
  CASE 
    WHEN es.effective_from <= CURRENT_DATE 
         AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    THEN '✅ ACTIVE'
    ELSE '❌ NOT ACTIVE'
  END as status
FROM employee_profiles ep
LEFT JOIN employee_shifts es ON ep.user_id = es.user_id 
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
LEFT JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
ORDER BY status, ep.first_name;


-- Step 2: Summary - How many employees have shifts?
-- ============================================================================
SELECT 
  'Total Active Employees' as metric,
  COUNT(*) as count
FROM employee_profiles
WHERE is_active = true

UNION ALL

SELECT 
  'Employees WITH Active Shift' as metric,
  COUNT(DISTINCT es.user_id) as count
FROM employee_shifts es
WHERE es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)

UNION ALL

SELECT 
  'Employees WITHOUT Shift' as metric,
  COUNT(*) as count
FROM employee_profiles ep
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM employee_shifts es 
    WHERE es.user_id = ep.user_id
      AND es.effective_from <= CURRENT_DATE
      AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  );


-- Step 3: Test get_employee_shift function
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_from_function,
  (SELECT start_time FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '✅ WORKING'
    ELSE '❌ NULL'
  END as function_status
FROM employee_profiles ep
WHERE ep.is_active = true
ORDER BY function_status, ep.first_name;


-- Step 4: Check today's attendance - do they have shift_id?
-- ============================================================================
SELECT 
  a.id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.date,
  a.shift_id,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist_time,
  a.is_late,
  a.calculated_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '❌ NO SHIFT_ID'
    ELSE '✅ HAS SHIFT_ID'
  END as shift_status
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
ORDER BY a.check_in_time;


-- Step 5: Verify late threshold is working correctly
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist_time,
  a.is_late as marked_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as should_be,
  CASE 
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as threshold_working
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
ORDER BY threshold_working, a.check_in_time;


-- Step 6: Check if any attendance records need shift_id update
-- ============================================================================
SELECT 
  COUNT(*) as records_without_shift_id,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM attendance
WHERE shift_id IS NULL
  AND date >= '2026-04-01';


-- Step 7: Final Verdict
-- ============================================================================
WITH checks AS (
  -- Check 1: All employees have shifts
  SELECT 
    'All Employees Have Shifts' as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ PASS'
      ELSE '❌ FAIL - ' || COUNT(*) || ' employees without shift'
    END as result
  FROM employee_profiles ep
  WHERE ep.is_active = true
    AND NOT EXISTS (
      SELECT 1 
      FROM employee_shifts es 
      WHERE es.user_id = ep.user_id
        AND es.effective_from <= CURRENT_DATE
        AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    )
  
  UNION ALL
  
  -- Check 2: Today's attendance has shift_id
  SELECT 
    'Today Attendance Has shift_id' as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ PASS'
      ELSE '❌ FAIL - ' || COUNT(*) || ' records without shift_id'
    END as result
  FROM attendance
  WHERE date = CURRENT_DATE
    AND shift_id IS NULL
  
  UNION ALL
  
  -- Check 3: Late threshold working correctly
  SELECT 
    'Late Threshold Working' as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ PASS'
      ELSE '❌ FAIL - ' || COUNT(*) || ' records with wrong late flag'
    END as result
  FROM attendance a
  JOIN shifts s ON a.shift_id = s.id
  WHERE a.date = CURRENT_DATE
    AND a.check_in_time IS NOT NULL
    AND a.shift_id IS NOT NULL
    AND NOT (
      (a.is_late = true 
       AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
           > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    )
  
  UNION ALL
  
  -- Check 4: get_employee_shift function working
  SELECT 
    'get_employee_shift Function Working' as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ PASS'
      ELSE '❌ FAIL - ' || COUNT(*) || ' employees return NULL'
    END as result
  FROM employee_profiles ep
  WHERE ep.is_active = true
    AND (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NULL
)
SELECT * FROM checks;


-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- If all checks show ✅ PASS, then shifts are working correctly!
-- If any check shows ❌ FAIL, scroll up to see which step has issues
-- ============================================================================

