-- ============================================================================
-- VERIFICATION: Check which shifts have correct late threshold working
-- Run this in Supabase SQL Editor to analyze all shifts
-- ============================================================================

-- Step 1: List all shifts with their settings
-- ============================================================================
SELECT 
  s.id,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_after_time,
  COUNT(DISTINCT es.user_id) as total_employees_assigned
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
GROUP BY s.id, s.name, s.start_time, s.end_time, s.late_threshold_minutes
ORDER BY s.name;


-- Step 2: Analyze April 15-16 attendance (clean data) for each shift
-- ============================================================================
SELECT 
  s.name as shift_name,
  s.start_time as shift_start,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  COUNT(*) as total_checkins,
  SUM(CASE 
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN 1 ELSE 0 
  END) as correct_count,
  SUM(CASE 
    WHEN (a.is_late = true 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      OR (a.is_late = false 
          AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
              <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    THEN 0 ELSE 1 
  END) as wrong_count,
  ROUND(
    (SUM(CASE 
      WHEN (a.is_late = true 
            AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
        OR (a.is_late = false 
            AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      THEN 1 ELSE 0 
    END)::numeric / COUNT(*)::numeric * 100), 2
  ) as accuracy_percentage,
  CASE 
    WHEN ROUND(
      (SUM(CASE 
        WHEN (a.is_late = true 
              AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                  > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
          OR (a.is_late = false 
              AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                  <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
        THEN 1 ELSE 0 
      END)::numeric / COUNT(*)::numeric * 100), 2
    ) = 100 THEN '✅ WORKING CORRECTLY'
    ELSE '❌ HAS ISSUES'
  END as status
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status IN ('present', 'late')
GROUP BY s.id, s.name, s.start_time, s.late_threshold_minutes
ORDER BY accuracy_percentage DESC, s.name;


-- Step 3: Show specific problematic records for each shift
-- ============================================================================
SELECT 
  s.name as shift_name,
  a.date,
  a.check_in_time as stored_utc,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as check_in_ist,
  (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME as time_only_ist,
  s.start_time,
  s.late_threshold_minutes,
  (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  a.is_late as marked_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN 'Should be LATE'
    ELSE 'Should be ON TIME'
  END as should_be,
  ep.first_name || ' ' || ep.last_name as employee_name,
  '❌ MISMATCH' as issue
FROM attendance a
JOIN shifts s ON a.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.date IN ('2026-04-15', '2026-04-16')
  AND a.check_in_time IS NOT NULL
  AND a.calculated_status IN ('present', 'late')
  AND NOT (
    (a.is_late = true 
     AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
         > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
    OR (a.is_late = false 
        AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
            <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
  )
ORDER BY s.name, a.date, a.check_in_time;


-- Step 4: Quick summary - Which shifts are working correctly?
-- ============================================================================
WITH shift_accuracy AS (
  SELECT 
    s.name as shift_name,
    COUNT(*) as total,
    SUM(CASE 
      WHEN (a.is_late = true 
            AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                > (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
        OR (a.is_late = false 
            AND (a.check_in_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TIME 
                <= (s.start_time::TIME + (s.late_threshold_minutes || ' minutes')::INTERVAL))
      THEN 1 ELSE 0 
    END) as correct
  FROM attendance a
  JOIN shifts s ON a.shift_id = s.id
  WHERE a.date IN ('2026-04-15', '2026-04-16')
    AND a.check_in_time IS NOT NULL
    AND a.calculated_status IN ('present', 'late')
  GROUP BY s.name
)
SELECT 
  shift_name,
  total as total_records,
  correct as correct_records,
  (total - correct) as wrong_records,
  ROUND((correct::numeric / total::numeric * 100), 2) as accuracy_pct,
  CASE 
    WHEN correct = total THEN '✅ PERFECT'
    WHEN correct::numeric / total::numeric >= 0.9 THEN '⚠️ MOSTLY OK'
    ELSE '❌ NEEDS FIX'
  END as status
FROM shift_accuracy
ORDER BY accuracy_pct DESC;

