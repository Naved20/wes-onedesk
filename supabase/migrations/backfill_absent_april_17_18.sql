-- ============================================================================
-- BACKFILL ABSENT RECORDS FOR APRIL 17 & 18, 2026
-- Manually create absent records for employees who didn't check in
-- ============================================================================

-- Step 1: Check who should be marked absent on April 17
-- ============================================================================
SELECT 
  '=== APRIL 17 - Employees to be marked ABSENT ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.last_checkin_hours_before_end,
  ('2026-04-17'::DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  CASE 
    WHEN EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = '2026-04-17')
    THEN '✅ Has attendance record'
    ELSE '❌ Will be marked ABSENT'
  END as status
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
  AND es.effective_from <= '2026-04-17'
  AND (es.effective_to IS NULL OR es.effective_to >= '2026-04-17')
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
ORDER BY s.name, ep.first_name;


-- Step 2: Create absent records for April 17
-- ============================================================================
SELECT create_absent_records_for_date('2026-04-17'::DATE) as april_17_absent_count;


-- Step 3: Check who should be marked absent on April 18
-- ============================================================================
SELECT 
  '=== APRIL 18 - Employees to be marked ABSENT ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.last_checkin_hours_before_end,
  ('2026-04-18'::DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  CASE 
    WHEN EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = '2026-04-18')
    THEN '✅ Has attendance record'
    ELSE '❌ Will be marked ABSENT'
  END as status
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
  AND es.effective_from <= '2026-04-18'
  AND (es.effective_to IS NULL OR es.effective_to >= '2026-04-18')
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
ORDER BY s.name, ep.first_name;


-- Step 4: Create absent records for April 18
-- ============================================================================
SELECT create_absent_records_for_date('2026-04-18'::DATE) as april_18_absent_count;


-- Step 5: Verify the absent records were created
-- ============================================================================
SELECT 
  '=== VERIFICATION - Absent records created ===' as section;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  a.calculated_status,
  a.status,
  a.notes,
  a.created_at
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date IN ('2026-04-17', '2026-04-18')
  AND a.calculated_status = 'absent'
  AND a.check_in_time IS NULL
ORDER BY a.date, ep.first_name;


-- Step 6: Summary
-- ============================================================================
SELECT 
  '=== SUMMARY ===' as section;

SELECT 
  a.date,
  COUNT(*) as total_absent,
  COUNT(CASE WHEN a.notes LIKE '%Auto-marked%' THEN 1 END) as auto_marked,
  COUNT(CASE WHEN a.notes NOT LIKE '%Auto-marked%' THEN 1 END) as manual_marked
FROM attendance a
WHERE a.date IN ('2026-04-17', '2026-04-18')
  AND a.calculated_status = 'absent'
GROUP BY a.date
ORDER BY a.date;


-- ============================================================================
-- NOTES:
-- ============================================================================
-- This script will:
-- 1. Show which employees should be marked absent on April 17 & 18
-- 2. Create absent records for those employees
-- 3. Verify the records were created correctly
-- 4. Show a summary of absent records
--
-- The function create_absent_records_for_date() will:
-- - Skip employees who already have attendance records
-- - Skip holidays and Sundays
-- - Only mark absent if shift's last check-in deadline has passed
-- - Set status = 'rejected' and calculated_status = 'absent'
-- ============================================================================
