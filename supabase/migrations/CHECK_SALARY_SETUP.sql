-- =====================================================
-- CHECK SALARY SETUP AND DATA
-- =====================================================

-- 1. Check attendance table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance' 
ORDER BY ordinal_position;

-- 2. Check if salary_structures table exists and has data
SELECT 
  COUNT(*) as total_structures,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_structures
FROM salary_structures;

-- 3. Check specific employee's salary structure
SELECT 
  ep.first_name,
  ep.last_name,
  ep.employee_id,
  ss.fixed_gross_salary,
  ss.basic_percentage,
  ss.hra_percentage,
  ss.is_active
FROM employee_profiles ep
LEFT JOIN salary_structures ss ON ep.user_id = ss.user_id AND ss.is_active = true
LIMIT 10;

-- 4. Check existing salary records for May 2026
SELECT 
  ep.first_name,
  ep.last_name,
  s.base_salary,
  s.working_days,
  s.present_days,
  s.gross_salary,
  s.approval_status
FROM salaries s
JOIN employee_profiles ep ON s.user_id = ep.user_id
WHERE s.month = 5 AND s.year = 2026
LIMIT 10;

-- 5. Sample attendance records
SELECT * FROM attendance 
WHERE EXTRACT(YEAR FROM date) = 2026 
  AND EXTRACT(MONTH FROM date) = 5
LIMIT 5;
