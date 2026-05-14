-- Check if salary related tables exist
-- Run these queries in Supabase SQL Editor

-- 1. Check all tables in database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%salary%' 
  OR table_name LIKE '%payroll%'
  OR table_name LIKE '%earning%'
  OR table_name LIKE '%deduction%';

-- 2. Check employee_profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employee_profiles'
ORDER BY ordinal_position;

-- 3. Check if salary columns exist in employee_profiles
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'employee_profiles'
  AND (column_name LIKE '%salary%' 
    OR column_name LIKE '%bank%'
    OR column_name LIKE '%pf%'
    OR column_name LIKE '%esic%');

-- 4. Check attendance table (for integration)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;

-- 5. Sample employee data to see current structure
SELECT 
  user_id,
  first_name,
  last_name,
  department,
  designation,
  created_at
FROM employee_profiles
LIMIT 5;
