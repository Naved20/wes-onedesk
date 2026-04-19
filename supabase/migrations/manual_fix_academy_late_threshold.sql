-- ============================================================================
-- MANUAL FIX: Academy Shift Late Threshold Issue (April 15-16)
-- Run this in Supabase SQL Editor to fix the specific Academy shift issue
-- ============================================================================

-- Problem: Academy shift employees checking in at 12:55 PM (before 1:15 PM cutoff)
-- are being marked as late. This is because the late threshold comparison
-- was happening in UTC instead of IST.

-- Step 1: Check current status (BEFORE fix)
-- ============================================================================
SELECT 
  a.date,
  a.check_in_time as stored_time_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  a.is_late as currently_marked_late,
  a.calculated_status,
  ep.first_name || ' ' || ep.last_name as employee_name,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as correct_status
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date, a.check_in_time;


-- Step 2: Fix the is_late flag for Academy shift (April 15-16)
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
  AND a.date IN ('2026-04-15', '2026-04-16')
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL;


-- Step 3: Verify the fix (AFTER)
-- ============================================================================
SELECT 
  a.date,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as check_in_time_ist,
  s.name as shift_name,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.is_late as now_marked_late,
  a.calculated_status,
  ep.first_name || ' ' || ep.last_name as employee_name,
  CASE 
    WHEN a.is_late = true 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT (Late)'
    WHEN a.is_late = false 
         AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
             <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '✅ CORRECT (On Time)'
    ELSE '❌ STILL WRONG'
  END as verification
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
ORDER BY a.date, a.check_in_time;


-- Step 4: Summary report
-- ============================================================================
SELECT 
  s.name as shift_name,
  COUNT(*) as total_records,
  SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END) as late_count,
  SUM(CASE WHEN NOT a.is_late THEN 1 ELSE 0 END) as on_time_count
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND s.name ILIKE '%academy%'
  AND a.check_in_time IS NOT NULL
GROUP BY s.name;

