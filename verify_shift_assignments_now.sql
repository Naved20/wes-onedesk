-- ============================================================================
-- QUICK VERIFICATION: Check if shift assignments are working now
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check current active shift assignments
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as assigned_shift,
  s.start_time || ' - ' || s.end_time as shift_timings,
  s.late_threshold_minutes as late_threshold_min,
  es.effective_from,
  es.effective_to,
  CASE 
    WHEN es.effective_from <= CURRENT_DATE 
         AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    THEN '✅ ACTIVE NOW'
    WHEN es.effective_from > CURRENT_DATE
    THEN '⏳ FUTURE'
    ELSE '❌ EXPIRED'
  END as status
FROM employee_shifts es
JOIN employee_profiles ep ON es.user_id = ep.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
ORDER BY status, ep.first_name;


-- Step 2: Count summary
-- ============================================================================
SELECT 
  'Total Active Employees' as metric,
  COUNT(*) as count
FROM employee_profiles
WHERE is_active = true

UNION ALL

SELECT 
  'Employees with Active Shift' as metric,
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


-- Step 3: Test get_employee_shift function for a few employees
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as current_shift_from_function,
  (SELECT start_time FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '✅ FUNCTION WORKING'
    ELSE '❌ FUNCTION RETURNS NULL'
  END as function_status
FROM employee_profiles ep
WHERE ep.is_active = true
ORDER BY function_status, ep.first_name
LIMIT 20;


-- Step 4: Check recent attendance records - do they have shift_id now?
-- ============================================================================
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.shift_id,
  s.name as shift_name,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist,
  a.is_late,
  a.calculated_status,
  CASE 
    WHEN a.shift_id IS NULL THEN '❌ NO SHIFT_ID'
    ELSE '✅ HAS SHIFT_ID'
  END as shift_status
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY a.date DESC, a.check_in_time DESC
LIMIT 30;


-- Step 5: Check if late threshold is working correctly NOW
-- ============================================================================
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
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
WHERE a.date >= CURRENT_DATE - INTERVAL '3 days'
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
ORDER BY a.date DESC, a.check_in_time DESC
LIMIT 30;


-- Step 6: Final verdict - Is everything working?
-- ============================================================================
WITH checks AS (
  SELECT 
    'Employees with Active Shifts' as check_name,
    COUNT(DISTINCT es.user_id) as count,
    (SELECT COUNT(*) FROM employee_profiles WHERE is_active = true) as total,
    CASE 
      WHEN COUNT(DISTINCT es.user_id) = (SELECT COUNT(*) FROM employee_profiles WHERE is_active = true)
      THEN '✅ ALL ASSIGNED'
      ELSE '⚠️ SOME MISSING'
    END as status
  FROM employee_shifts es
  WHERE es.effective_from <= CURRENT_DATE
    AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  
  UNION ALL
  
  SELECT 
    'Recent Attendance with shift_id' as check_name,
    COUNT(*) as count,
    (SELECT COUNT(*) FROM attendance WHERE date >= CURRENT_DATE - INTERVAL '3 days') as total,
    CASE 
      WHEN COUNT(*) = (SELECT COUNT(*) FROM attendance WHERE date >= CURRENT_DATE - INTERVAL '3 days')
      THEN '✅ ALL HAVE SHIFT_ID'
      ELSE '⚠️ SOME NULL'
    END as status
  FROM attendance
  WHERE date >= CURRENT_DATE - INTERVAL '3 days'
    AND shift_id IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'Late Threshold Working Correctly' as check_name,
    COUNT(*) as count,
    (SELECT COUNT(*) FROM attendance a 
     JOIN shifts s ON a.shift_id = s.id 
     WHERE a.date >= CURRENT_DATE - INTERVAL '3 days' 
       AND a.check_in_time IS NOT NULL
       AND a.shift_id IS NOT NULL) as total,
    CASE 
      WHEN COUNT(*) = (SELECT COUNT(*) FROM attendance a 
                       JOIN shifts s ON a.shift_id = s.id 
                       WHERE a.date >= CURRENT_DATE - INTERVAL '3 days' 
                         AND a.check_in_time IS NOT NULL
                         AND a.shift_id IS NOT NULL)
      THEN '✅ ALL CORRECT'
      ELSE '❌ SOME WRONG'
    END as status
  FROM attendance a
  JOIN shifts s ON a.shift_id = s.id
  WHERE a.date >= CURRENT_DATE - INTERVAL '3 days'
    AND a.check_in_time IS NOT NULL
    AND a.shift_id IS NOT NULL
    AND (
      (a.is_late = true 
       AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
           > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    )
)
SELECT 
  check_name,
  count || ' / ' || total as ratio,
  status
FROM checks;

