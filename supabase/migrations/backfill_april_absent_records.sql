-- ============================================================================
-- BACKFILL: Create Absent Records for Past April Dates
-- Run this AFTER running run_this_to_fix_absent.sql
-- This will create absent records for all past dates in April
-- ============================================================================

-- Option 1: Backfill for entire April (up to yesterday)
-- ============================================================================
SELECT * FROM create_absent_records_for_range(
  '2026-04-01'::DATE, 
  (CURRENT_DATE - INTERVAL '1 day')::DATE
);

-- This will show you how many records were created for each date


-- Option 2: Verify April absent records
-- ============================================================================
SELECT 
  a.date,
  COUNT(*) as total_attendance,
  SUM(CASE WHEN a.check_in_time IS NOT NULL THEN 1 ELSE 0 END) as present_count,
  SUM(CASE WHEN a.calculated_status = 'absent' AND a.check_in_time IS NULL THEN 1 ELSE 0 END) as absent_count
FROM attendance a
WHERE a.date >= '2026-04-01' 
  AND a.date < CURRENT_DATE
GROUP BY a.date
ORDER BY a.date DESC;


-- Option 3: Check if any employees are still missing attendance records
-- ============================================================================
SELECT 
  d.date,
  COUNT(DISTINCT ep.user_id) as total_employees,
  COUNT(DISTINCT a.user_id) as employees_with_records,
  COUNT(DISTINCT ep.user_id) - COUNT(DISTINCT a.user_id) as missing_records
FROM generate_series(
  '2026-04-01'::DATE,
  (CURRENT_DATE - INTERVAL '1 day')::DATE,
  '1 day'::INTERVAL
) d(date)
CROSS JOIN employee_profiles ep
LEFT JOIN attendance a ON a.user_id = ep.user_id AND a.date = d.date
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.date = d.date
  )
  AND EXTRACT(DOW FROM d.date) != 0  -- Exclude Sundays
GROUP BY d.date
HAVING COUNT(DISTINCT ep.user_id) - COUNT(DISTINCT a.user_id) > 0
ORDER BY d.date DESC;


-- ============================================================================
-- DONE! All April dates should now have complete attendance records
-- ============================================================================

