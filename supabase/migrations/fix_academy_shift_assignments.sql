-- ============================================================================
-- FIX: Academy Shift Assignment Issues
-- Run this after diagnosing the problem
-- ============================================================================

-- Step 1: Show current situation
-- ============================================================================
SELECT 
  '=== BEFORE FIX ===' as section;

SELECT 
  s.name,
  s.id,
  s.start_time,
  s.late_threshold_minutes,
  s.is_active,
  COUNT(DISTINCT es.user_id) as employees_assigned
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.name ILIKE '%academy%'
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes, s.is_active
ORDER BY s.created_at DESC;


-- Step 2: Deactivate old Academy shifts (keep only the newest one)
-- ============================================================================
-- This will keep the most recently created Academy shift active
-- and deactivate all older ones

WITH newest_academy AS (
  SELECT id
  FROM shifts
  WHERE name ILIKE '%academy%'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE shifts
SET is_active = false
WHERE name ILIKE '%academy%'
  AND id NOT IN (SELECT id FROM newest_academy);

SELECT 
  '✅ Deactivated old Academy shifts' as action,
  COUNT(*) as shifts_deactivated
FROM shifts
WHERE name ILIKE '%academy%' AND is_active = false;


-- Step 3: Get the active Academy shift ID
-- ============================================================================
DO $$
DECLARE
  v_academy_shift_id UUID;
  v_shift_name TEXT;
BEGIN
  -- Get the active Academy shift
  SELECT id, name INTO v_academy_shift_id, v_shift_name
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_academy_shift_id IS NULL THEN
    RAISE EXCEPTION 'No active Academy shift found!';
  END IF;
  
  RAISE NOTICE 'Using Academy shift: % (ID: %)', v_shift_name, v_academy_shift_id;
END $$;


-- Step 4: Update shift assignments for Academy employees
-- ============================================================================
-- This will reassign all Academy employees to the newest Academy shift

WITH academy_shift AS (
  SELECT id as shift_id
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
),
academy_employees AS (
  SELECT user_id
  FROM employee_profiles
  WHERE institution_assignment ILIKE '%academy%'
    AND is_active = true
)
-- First, end all existing shift assignments for Academy employees
UPDATE employee_shifts es
SET effective_to = CURRENT_DATE - INTERVAL '1 day'
WHERE es.user_id IN (SELECT user_id FROM academy_employees)
  AND es.effective_to IS NULL;

-- Then, create new assignments with the correct shift
WITH academy_shift AS (
  SELECT id as shift_id
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
),
academy_employees AS (
  SELECT user_id
  FROM employee_profiles
  WHERE institution_assignment ILIKE '%academy%'
    AND is_active = true
)
INSERT INTO employee_shifts (user_id, shift_id, effective_from, effective_to, notes)
SELECT 
  ae.user_id,
  a_shift.shift_id,
  CURRENT_DATE,
  NULL,
  'Reassigned to new Academy shift'
FROM academy_employees ae
CROSS JOIN academy_shift a_shift
ON CONFLICT DO NOTHING;

SELECT 
  '✅ Updated shift assignments for Academy employees' as action,
  COUNT(*) as employees_reassigned
FROM employee_shifts es
JOIN shifts s ON es.shift_id = s.id
WHERE s.name ILIKE '%academy%'
  AND es.effective_from = CURRENT_DATE;


-- Step 5: Backfill shift_id for recent attendance records
-- ============================================================================
-- Update attendance records from last 30 days that don't have shift_id

WITH academy_shift AS (
  SELECT id as shift_id
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE attendance a
SET shift_id = a_shift.shift_id
FROM academy_shift a_shift,
     employee_profiles ep
WHERE a.user_id = ep.user_id
  AND ep.institution_assignment ILIKE '%academy%'
  AND a.shift_id IS NULL
  AND a.date >= CURRENT_DATE - INTERVAL '30 days';

SELECT 
  '✅ Backfilled shift_id for attendance records' as action,
  COUNT(*) as records_updated
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
JOIN shifts s ON a.shift_id = s.id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND s.name ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '30 days';


-- Step 6: Recalculate late flags for recent Academy attendance
-- ============================================================================
UPDATE attendance a
SET 
  is_late = CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN true
    ELSE false
  END,
  calculated_status = CASE
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
         >= (
           (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.end_time)
           - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
         )
    THEN 'absent'
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
         >= (
           (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.start_time)
           + (s.half_day_threshold_hours || ' hours')::INTERVAL
         )
    THEN 'half_day'
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'late'
    ELSE 'present'
  END
FROM shifts s
WHERE a.shift_id = s.id
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= CURRENT_DATE - INTERVAL '7 days';

SELECT 
  '✅ Recalculated late flags' as action,
  COUNT(*) as records_updated
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE s.name ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days';


-- Step 7: Verification
-- ============================================================================
SELECT 
  '=== AFTER FIX - VERIFICATION ===' as section;

-- Check shift configuration
SELECT 
  'Active Academy Shift' as check_type,
  s.name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  COUNT(DISTINCT es.user_id) as employees_assigned
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.name ILIKE '%academy%' AND s.is_active = true
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes;

-- Check employees have correct shift
SELECT 
  'Academy Employees with Shift' as check_type,
  COUNT(*) as total_employees,
  SUM(CASE WHEN shift_name IS NOT NULL THEN 1 ELSE 0 END) as with_shift,
  SUM(CASE WHEN shift_name IS NULL THEN 1 ELSE 0 END) as without_shift
FROM (
  SELECT 
    ep.user_id,
    (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_name
  FROM employee_profiles ep
  WHERE ep.institution_assignment ILIKE '%academy%'
    AND ep.is_active = true
) sub;

-- Check attendance records have shift_id
SELECT 
  'Attendance Records with shift_id' as check_type,
  COUNT(*) as total_records,
  SUM(CASE WHEN a.shift_id IS NOT NULL THEN 1 ELSE 0 END) as with_shift_id,
  SUM(CASE WHEN a.shift_id IS NULL THEN 1 ELSE 0 END) as without_shift_id
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE ep.institution_assignment ILIKE '%academy%'
  AND a.date >= CURRENT_DATE - INTERVAL '7 days';


-- Final status
SELECT 
  '=== FINAL STATUS ===' as section;

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM shifts WHERE name ILIKE '%academy%' AND is_active = true) = 1
         AND EXISTS (
           SELECT 1 FROM employee_shifts es
           JOIN shifts s ON es.shift_id = s.id
           WHERE s.name ILIKE '%academy%'
             AND es.effective_from <= CURRENT_DATE
             AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
         )
         AND NOT EXISTS (
           SELECT 1 FROM attendance a
           JOIN employee_profiles ep ON a.user_id = ep.user_id
           WHERE ep.institution_assignment ILIKE '%academy%'
             AND a.date >= CURRENT_DATE - INTERVAL '7 days'
             AND a.shift_id IS NULL
         )
    THEN '✅✅✅ ALL FIXED! Academy shift should work correctly now!'
    ELSE '⚠️ Some issues may remain - check verification above'
  END as final_status;


-- ============================================================================
-- WHAT THIS SCRIPT DOES:
-- ============================================================================
-- 1. Deactivates old Academy shifts (keeps only newest)
-- 2. Reassigns all Academy employees to the new shift
-- 3. Backfills shift_id for recent attendance records
-- 4. Recalculates late flags based on new shift settings
-- 5. Verifies everything is fixed
--
-- After running this:
-- - Only one active Academy shift
-- - All Academy employees assigned to it
-- - All attendance records have correct shift_id
-- - Late flags recalculated correctly
-- ============================================================================
