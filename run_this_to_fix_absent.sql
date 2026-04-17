-- ============================================================================
-- SIMPLE FIX: Create Absent Records for Today
-- Copy-paste this ENTIRE file in Supabase SQL Editor and run
-- ============================================================================

-- Step 1: Create absent records for TODAY only
-- ============================================================================
SELECT create_absent_records_for_date(CURRENT_DATE);

-- You should see a number returned (e.g., 13) = number of absent records created


-- Step 2: Verify the results
-- ============================================================================
SELECT 
  'Total Active Employees' as metric,
  COUNT(*) as count
FROM employee_profiles
WHERE is_active = true

UNION ALL

SELECT 
  'Present (Checked In Today)' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND check_in_time IS NOT NULL

UNION ALL

SELECT 
  'Absent (Auto-marked Today)' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND calculated_status = 'absent'
  AND check_in_time IS NULL

UNION ALL

SELECT 
  'Total Attendance Records Today' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE;


-- Step 3: See who was marked absent
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  a.notes,
  a.created_at as marked_absent_at
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.calculated_status = 'absent'
  AND a.check_in_time IS NULL
ORDER BY ep.first_name;


-- ============================================================================
-- DONE! Now refresh your Attendance page in the browser
-- You should see:
-- - Total: 24 (or your total employee count)
-- - Present: 11 (or however many checked in)
-- - Absent: 13 (or however many didn't check in)
-- ============================================================================

