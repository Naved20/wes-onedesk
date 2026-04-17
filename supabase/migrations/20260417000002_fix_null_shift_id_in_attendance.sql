-- ============================================================================
-- FIX NULL SHIFT_ID IN ATTENDANCE RECORDS
-- This migration backfills shift_id for attendance records that are missing it
-- ============================================================================

-- Step 1: Check how many records have NULL shift_id (preview only)
-- ============================================================================
-- SELECT 
--   COUNT(*) as total_null_shift_records,
--   MIN(date) as earliest_date,
--   MAX(date) as latest_date
-- FROM attendance
-- WHERE shift_id IS NULL;


-- Step 2: Update attendance records with NULL shift_id
-- ============================================================================
-- For each attendance record without shift_id, find the employee's active shift
-- for that date and update the record

UPDATE attendance a
SET 
  shift_id = es.shift_id,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (a2.id)
    a2.id as attendance_id,
    es2.shift_id
  FROM attendance a2
  JOIN employee_shifts es2 ON a2.user_id = es2.user_id
  WHERE a2.shift_id IS NULL
    AND es2.effective_from <= a2.date
    AND (es2.effective_to IS NULL OR es2.effective_to >= a2.date)
  ORDER BY a2.id, es2.effective_from DESC
) es
WHERE a.id = es.attendance_id;


-- Step 3: Recalculate calculated_status and is_late for updated records
-- ============================================================================
UPDATE attendance a
SET 
  calculated_status = calculate_attendance_status(
    a.check_in_time,
    s.start_time,
    s.end_time,
    s.late_threshold_minutes,
    s.half_day_threshold_hours,
    s.last_checkin_hours_before_end
  ),
  is_late = CASE 
    WHEN calculate_attendance_status(
      a.check_in_time,
      s.start_time,
      s.end_time,
      s.late_threshold_minutes,
      s.half_day_threshold_hours,
      s.last_checkin_hours_before_end
    ) = 'late' THEN true
    ELSE false
  END,
  updated_at = NOW()
FROM shifts s
WHERE a.shift_id = s.id
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status IS NULL;


-- Step 4: Verification - Check if any NULL shift_id records remain
-- ============================================================================
-- SELECT 
--   a.date,
--   ep.first_name || ' ' || ep.last_name as employee_name,
--   a.shift_id,
--   a.check_in_time,
--   CASE 
--     WHEN a.shift_id IS NULL THEN '❌ STILL NULL'
--     ELSE '✅ FIXED'
--   END as status
-- FROM attendance a
-- JOIN employee_profiles ep ON a.user_id = ep.user_id
-- WHERE a.date >= '2026-04-01'
-- ORDER BY a.date DESC, ep.first_name
-- LIMIT 20;


-- Step 5: Summary report
-- ============================================================================
-- SELECT 
--   'Total Attendance Records' as metric,
--   COUNT(*) as count
-- FROM attendance
-- WHERE date >= '2026-04-01'
-- 
-- UNION ALL
-- 
-- SELECT 
--   'Records with shift_id' as metric,
--   COUNT(*) as count
-- FROM attendance
-- WHERE date >= '2026-04-01'
--   AND shift_id IS NOT NULL
-- 
-- UNION ALL
-- 
-- SELECT 
--   'Records with NULL shift_id' as metric,
--   COUNT(*) as count
-- FROM attendance
-- WHERE date >= '2026-04-01'
--   AND shift_id IS NULL;

