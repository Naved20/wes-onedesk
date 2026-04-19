-- ============================================================================
-- FIX: Academy Shift Late Threshold Issue - Final Solution
-- ============================================================================
-- Problem: Academy shift employees are being incorrectly marked as late
-- Root Cause: Late threshold comparison not properly handling IST timezone
-- Solution: Recalculate is_late flag using proper IST timezone conversion
-- ============================================================================

-- Step 1: Show what will be fixed (BEFORE)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== BEFORE FIX ===';
END $$;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.is_late as currently_marked,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN true
    ELSE false
  END as should_be_marked,
  CASE 
    WHEN a.is_late != (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
      > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    )
    THEN '❌ WILL BE FIXED'
    ELSE '✅ Already Correct'
  END as status
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01'  -- Fix all April records
ORDER BY a.date DESC, a.check_in_time
LIMIT 50;


-- Step 2: Fix the is_late flag for ALL Academy shift records
-- ============================================================================
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== FIXING ACADEMY LATE FLAGS ===';
  
  -- Update is_late and calculated_status based on IST timezone
  UPDATE attendance a
  SET 
    is_late = CASE 
      WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
           > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
      THEN true
      ELSE false
    END,
    calculated_status = CASE
      -- Check if too late (absent)
      WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
           >= (
             (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.end_time)
             - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
           )
      THEN 'absent'
      -- Check if half day
      WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') 
           >= (
             (DATE(a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') + s.start_time)
             + (s.half_day_threshold_hours || ' hours')::INTERVAL
           )
      THEN 'half_day'
      -- Check if late
      WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
           > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
      THEN 'late'
      -- Otherwise present
      ELSE 'present'
    END,
    updated_at = NOW()
  FROM shifts s
  WHERE a.shift_id = s.id
    AND s.name ILIKE '%academy%'
    AND a.check_in_time IS NOT NULL
    AND a.date >= '2026-04-01';  -- Fix all April records onwards
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % Academy attendance records', v_updated_count;
END $$;


-- Step 3: Verify the fix (AFTER)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== AFTER FIX ===';
END $$;

SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.is_late as now_marked,
  a.calculated_status,
  CASE 
    WHEN a.is_late = (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
      > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    )
    THEN '✅ CORRECT'
    ELSE '❌ STILL WRONG'
  END as verification
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01'
ORDER BY a.date DESC, a.check_in_time
LIMIT 50;


-- Step 4: Summary report
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== SUMMARY ===';
END $$;

SELECT 
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  COUNT(*) as total_records,
  SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as late_count,
  SUM(CASE WHEN NOT a.is_late THEN 1 ELSE 0 END) as on_time_count,
  ROUND(100.0 * SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) / COUNT(*), 2) as late_percentage
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
  AND a.date >= '2026-04-01'
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY s.name;


-- Step 5: Verify no wrong flags remain
-- ============================================================================
DO $$
DECLARE
  v_wrong_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_wrong_count
  FROM attendance a
  JOIN shifts s ON a.shift_id = s.id
  WHERE s.name ILIKE '%academy%'
    AND a.check_in_time IS NOT NULL
    AND a.date >= '2026-04-01'
    AND a.is_late != (
      (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
      > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    );
  
  IF v_wrong_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All Academy late flags are now correct!';
  ELSE
    RAISE WARNING '❌ PROBLEM: Still % wrong late flags found', v_wrong_count;
  END IF;
END $$;


-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. First run: check_academy_late_threshold_issue.sql to see the problem
-- 2. Then run: this file (fix_academy_late_threshold_final.sql) to fix it
-- 3. Check the output to verify all flags are now correct
-- 
-- This will fix:
-- - Employees marked late when they checked in on time
-- - Employees marked on time when they were actually late
-- - Incorrect calculated_status values
-- 
-- The fix uses proper IST timezone conversion to compare check-in time
-- with the late threshold cutoff time.
-- ============================================================================
