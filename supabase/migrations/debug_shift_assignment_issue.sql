-- ============================================================================
-- DEBUG: Shift Assignment Issue Analysis
-- Run this in Supabase SQL Editor to understand why shifts aren't working
-- ============================================================================

-- Step 1: Check all shifts and their settings
-- ============================================================================
SELECT 
  id,
  name,
  start_time,
  end_time,
  late_threshold_minutes,
  half_day_threshold_hours,
  last_checkin_hours_before_end,
  is_active,
  created_at
FROM shifts
ORDER BY name;


-- Step 2: Check employee_shifts table - How many employees have shifts assigned?
-- ============================================================================
SELECT 
  COUNT(*) as total_assignments,
  COUNT(DISTINCT user_id) as unique_employees,
  COUNT(DISTINCT shift_id) as unique_shifts
FROM employee_shifts;


-- Step 3: Check current active shift assignments (today's date)
-- ============================================================================
SELECT 
  es.id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  es.effective_from,
  es.effective_to,
  CASE 
    WHEN es.effective_from <= CURRENT_DATE 
         AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE'
  END as status
FROM employee_shifts es
JOIN employee_profiles ep ON es.user_id = ep.user_id
JOIN shifts s ON es.shift_id = s.id
ORDER BY ep.first_name, es.effective_from DESC;


-- Step 4: Check employees WITHOUT any shift assignment
-- ============================================================================
SELECT 
  ep.user_id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.email,
  ep.institution_assignment,
  '❌ NO SHIFT ASSIGNED' as issue
FROM employee_profiles ep
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM employee_shifts es 
    WHERE es.user_id = ep.user_id
      AND es.effective_from <= CURRENT_DATE
      AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  )
ORDER BY ep.first_name;


-- Step 5: Check attendance records and their shift_id
-- ============================================================================
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.shift_id,
  s.name as shift_name_from_attendance,
  es_current.shift_id as current_assigned_shift_id,
  s_current.name as current_assigned_shift_name,
  CASE 
    WHEN a.shift_id IS NULL THEN '❌ NO SHIFT IN ATTENDANCE'
    WHEN a.shift_id != es_current.shift_id THEN '⚠️ MISMATCH'
    ELSE '✅ CORRECT'
  END as shift_status
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
LEFT JOIN LATERAL (
  SELECT shift_id 
  FROM employee_shifts 
  WHERE user_id = a.user_id
    AND effective_from <= a.date
    AND (effective_to IS NULL OR effective_to >= a.date)
  ORDER BY effective_from DESC
  LIMIT 1
) es_current ON true
LEFT JOIN shifts s_current ON es_current.shift_id = s_current.id
WHERE a.date >= '2026-04-01'
ORDER BY a.date DESC, ep.first_name
LIMIT 50;


-- Step 6: Check if get_employee_shift function is working correctly
-- ============================================================================
-- Test for a specific employee (replace with actual user_id)
-- SELECT * FROM get_employee_shift('USER_ID_HERE', CURRENT_DATE);

-- Test for all employees
SELECT 
  ep.user_id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as current_shift
FROM employee_profiles ep
WHERE ep.is_active = true
ORDER BY ep.first_name;


-- Step 7: Check attendance records with NULL shift_id
-- ============================================================================
SELECT 
  a.date,
  a.check_in_time,
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  a.shift_id,
  a.calculated_status,
  a.is_late,
  '❌ NULL SHIFT_ID' as issue
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.shift_id IS NULL
  AND a.date >= '2026-04-01'
ORDER BY a.date DESC, ep.first_name;


-- Step 8: Summary - Count by issue type
-- ============================================================================
WITH issue_summary AS (
  SELECT 
    'Total Employees' as category,
    COUNT(*) as count
  FROM employee_profiles
  WHERE is_active = true
  
  UNION ALL
  
  SELECT 
    'Employees with Shift Assigned' as category,
    COUNT(DISTINCT user_id) as count
  FROM employee_shifts
  WHERE effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  
  UNION ALL
  
  SELECT 
    'Employees WITHOUT Shift' as category,
    COUNT(*) as count
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
  
  SELECT 
    'April Attendance Records' as category,
    COUNT(*) as count
  FROM attendance
  WHERE date >= '2026-04-01' AND date <= '2026-04-30'
  
  UNION ALL
  
  SELECT 
    'April Records with NULL shift_id' as category,
    COUNT(*) as count
  FROM attendance
  WHERE date >= '2026-04-01' AND date <= '2026-04-30'
    AND shift_id IS NULL
)
SELECT * FROM issue_summary;


-- Step 9: Check if institution_assignment matches shift assignment
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as assigned_shift,
  CASE 
    WHEN ep.institution_assignment ILIKE '%DPS%' AND s.name ILIKE '%DPS%' THEN '✅ MATCH'
    WHEN ep.institution_assignment ILIKE '%Academy%' AND s.name ILIKE '%Academy%' THEN '✅ MATCH'
    WHEN ep.institution_assignment IS NULL THEN '⚠️ NO INSTITUTION'
    ELSE '❌ MISMATCH'
  END as institution_shift_match
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  AND ep.is_active = true
ORDER BY institution_shift_match, ep.first_name;

