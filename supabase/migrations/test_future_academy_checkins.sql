-- ============================================================================
-- TEST: Kya FUTURE Academy check-ins sahi honge?
-- ============================================================================

-- Test 1: Simulate check-in at different times TODAY
WITH academy_shift AS (
  SELECT 
    name,
    start_time,
    end_time,
    late_threshold_minutes,
    half_day_threshold_hours,
    last_checkin_hours_before_end
  FROM shifts
  WHERE name ILIKE '%academy%' AND is_active = true
  LIMIT 1
)
SELECT 
  '=== FUTURE CHECK-IN TESTS ===' as test_section,
  a.name as shift_name,
  a.start_time,
  a.late_threshold_minutes,
  (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff
FROM academy_shift a;

-- Test different check-in times
WITH test_times AS (
  SELECT '12:55:00'::TIME as time, 'Before shift (12:55 PM)' as scenario
  UNION ALL SELECT '13:00:00'::TIME, 'Exactly at start (1:00 PM)'
  UNION ALL SELECT '13:05:00'::TIME, '5 min late (1:05 PM)'
  UNION ALL SELECT '13:10:00'::TIME, '10 min late (1:10 PM)'
  UNION ALL SELECT '13:15:00'::TIME, 'At threshold (1:15 PM)'
  UNION ALL SELECT '13:16:00'::TIME, '16 min late (1:16 PM)'
  UNION ALL SELECT '13:20:00'::TIME, '20 min late (1:20 PM)'
  UNION ALL SELECT '13:30:00'::TIME, '30 min late (1:30 PM)'
),
academy_shift AS (
  SELECT * FROM shifts WHERE name ILIKE '%academy%' AND is_active = true LIMIT 1
)
SELECT 
  t.scenario,
  t.time as check_in_time,
  a.start_time as shift_start,
  (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff,
  calculate_attendance_status(
    (CURRENT_DATE + t.time)::TIMESTAMPTZ,
    a.start_time,
    a.end_time,
    a.late_threshold_minutes,
    a.half_day_threshold_hours,
    a.last_checkin_hours_before_end
  ) as will_be_marked_as,
  CASE 
    WHEN t.time > (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL)
    THEN '🔴 LATE'
    ELSE '🟢 ON TIME'
  END as late_flag,
  CASE 
    WHEN t.time <= (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL)
         AND calculate_attendance_status(
           (CURRENT_DATE + t.time)::TIMESTAMPTZ,
           a.start_time, a.end_time, a.late_threshold_minutes,
           a.half_day_threshold_hours, a.last_checkin_hours_before_end
         ) IN ('present', 'late')
    THEN '✅ CORRECT'
    WHEN t.time > (a.start_time::TIME + (a.late_threshold_minutes || ' minutes')::INTERVAL)
         AND calculate_attendance_status(
           (CURRENT_DATE + t.time)::TIMESTAMPTZ,
           a.start_time, a.end_time, a.late_threshold_minutes,
           a.half_day_threshold_hours, a.last_checkin_hours_before_end
         ) = 'late'
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as verification
FROM test_times t
CROSS JOIN academy_shift a
ORDER BY t.time;

-- Final verdict
SELECT 
  CASE 
    WHEN calculate_attendance_status(
      (CURRENT_DATE + '13:10:00'::TIME)::TIMESTAMPTZ,
      '13:00:00'::TIME, '19:00:00'::TIME, 15, 2.5, 3.5
    ) = 'present'
    AND calculate_attendance_status(
      (CURRENT_DATE + '13:20:00'::TIME)::TIMESTAMPTZ,
      '13:00:00'::TIME, '19:00:00'::TIME, 15, 2.5, 3.5
    ) = 'late'
    THEN '✅✅✅ YES! Future Academy check-ins will work CORRECTLY! ✅✅✅'
    ELSE '❌ Problem found in function'
  END as final_verdict;
