-- TEST QUERY: Run this first to see what will change
-- Copy-paste this in Supabase SQL Editor

-- 1. See current problematic records (BEFORE fix)
SELECT 
  date as attendance_date,
  check_in_time::date as checkin_date,
  check_in_time::time as checkin_time_only,
  check_in_time as full_checkin_timestamp,
  calculated_status,
  is_late,
  CASE 
    WHEN date::date != check_in_time::date THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END as status
FROM attendance
WHERE date >= '2026-04-01' 
  AND date < '2026-04-15'  -- Only till April 14
  AND check_in_time IS NOT NULL
ORDER BY date, check_in_time
LIMIT 20;

-- 2. Preview what the fix will do (AFTER fix preview)
SELECT 
  date as attendance_date,
  check_in_time as current_checkin,
  (date::text || ' ' || check_in_time::time::text)::timestamptz as fixed_checkin,
  calculated_status
FROM attendance
WHERE date >= '2026-04-01' 
  AND date < '2026-04-15'
  AND check_in_time IS NOT NULL
  AND date::date != check_in_time::date
ORDER BY date
LIMIT 10;

-- 3. Count how many records will be affected
SELECT 
  date,
  COUNT(*) as records_to_fix
FROM attendance
WHERE date >= '2026-04-01' 
  AND date < '2026-04-15'
  AND (
    (check_in_time IS NOT NULL AND date::date != check_in_time::date)
    OR
    (check_out_time IS NOT NULL AND date::date != check_out_time::date)
  )
GROUP BY date
ORDER BY date;
