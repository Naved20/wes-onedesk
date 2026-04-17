-- ============================================================================
-- FIX LATE FLAGS: Recalculate is_late for today's attendance
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Preview which records will be updated
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist_time,
  a.is_late as current_late_flag,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN true
    ELSE false
  END as should_be_late,
  CASE 
    WHEN a.is_late != (
      CASE 
        WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
        THEN true
        ELSE false
      END
    )
    THEN '🔄 WILL UPDATE'
    ELSE '✅ ALREADY CORRECT'
  END as action
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
ORDER BY action DESC, a.check_in_time;


-- Step 2: Update is_late flags for today
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
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'late'
    ELSE 'present'
  END,
  updated_at = NOW()
FROM shifts s
WHERE a.shift_id = s.id
  AND a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL;


-- Step 3: Verify the fix
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_ist_time,
  a.is_late,
  a.calculated_status,
  CASE 
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN '✅ CORRECT'
    ELSE '❌ STILL WRONG'
  END as verification
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND a.shift_id IS NOT NULL
ORDER BY verification DESC, a.check_in_time;


-- Step 4: Summary
-- ============================================================================
SELECT 
  'Total Records Today' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND check_in_time IS NOT NULL

UNION ALL

SELECT 
  'Marked as LATE' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND is_late = true
  AND check_in_time IS NOT NULL

UNION ALL

SELECT 
  'Marked as ON TIME' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND is_late = false
  AND check_in_time IS NOT NULL

UNION ALL

SELECT 
  'Correctly Marked' as metric,
  COUNT(*) as count
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.check_in_time IS NOT NULL
  AND (
    (a.is_late = true 
     AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    OR (a.is_late = false 
        AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
            <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
  );


-- ============================================================================
-- DONE! All late flags should now be correct
-- Refresh your attendance page to see the updated flags
-- ============================================================================

