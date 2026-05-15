-- =====================================================
-- TEST SALARY GENERATION - SIMPLE VERSION
-- =====================================================

-- Step 1: Check salary structures
SELECT 
  COUNT(*) as total_structures,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_structures
FROM salary_structures;

-- Step 2: List employees with/without salary structure
SELECT 
  ep.first_name,
  ep.last_name,
  ep.employee_id,
  CASE WHEN ss.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_structure,
  ss.fixed_gross_salary
FROM employee_profiles ep
LEFT JOIN salary_structures ss ON ep.user_id = ss.user_id AND ss.is_active = true
WHERE ep.is_active = true
ORDER BY ep.first_name
LIMIT 10;

-- Step 3: Check attendance records for May 2026
SELECT 
  COUNT(*) as total_attendance_records,
  COUNT(DISTINCT user_id) as employees_with_attendance
FROM attendance
WHERE EXTRACT(YEAR FROM date) = 2026 
  AND EXTRACT(MONTH FROM date) = 5;

-- Step 4: Check if calculate_attendance_stats function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%attendance%';

-- Step 5: Check existing salary records for May 2026
SELECT 
  COUNT(*) as total_salary_records,
  COUNT(CASE WHEN base_salary > 0 THEN 1 END) as with_base_salary,
  COUNT(CASE WHEN base_salary = 0 THEN 1 END) as without_base_salary
FROM salaries
WHERE month = 5 AND year = 2026;
