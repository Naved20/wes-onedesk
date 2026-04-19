-- ============================================================================
-- MANUAL: Create Absent Records for Today
-- Run this in Supabase SQL Editor to immediately create absent records
-- ============================================================================

-- Option 1: Create absent records for today only
-- ============================================================================
SELECT create_absent_records_for_date(CURRENT_DATE);


-- Option 2: Create absent records for April 17, 2026
-- ============================================================================
SELECT create_absent_records_for_date('2026-04-17');


-- Option 3: Create absent records for last 7 days
-- ============================================================================
SELECT * FROM create_absent_records_for_range(
  (CURRENT_DATE - INTERVAL '7 days')::DATE,
  CURRENT_DATE::DATE
);


-- Option 4: Check which employees will be marked absent (PREVIEW)
-- ============================================================================
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.last_checkin_hours_before_end,
  (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  NOW() as current_time,
  CASE 
    WHEN NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
    THEN '✅ Will be marked ABSENT'
    ELSE '⏳ Still within check-in time'
  END as status
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.user_id = ep.user_id
    AND a.date = CURRENT_DATE
  )
ORDER BY last_checkin_deadline;


-- Option 5: Verify absent records were created
-- ============================================================================
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  a.calculated_status,
  a.notes,
  a.created_at
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.calculated_status = 'absent'
  AND a.check_in_time IS NULL
ORDER BY a.created_at DESC;


-- Option 6: Count summary for today
-- ============================================================================
SELECT 
  'Total Employees' as metric,
  COUNT(*) as count
FROM employee_profiles
WHERE is_active = true

UNION ALL

SELECT 
  'Present (Checked In)' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND check_in_time IS NOT NULL

UNION ALL

SELECT 
  'Absent (Auto-marked)' as metric,
  COUNT(*) as count
FROM attendance
WHERE date = CURRENT_DATE
  AND calculated_status = 'absent'
  AND check_in_time IS NULL

UNION ALL

SELECT 
  'Not Yet Marked' as metric,
  COUNT(*) as count
FROM employee_profiles ep
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.user_id = ep.user_id
    AND a.date = CURRENT_DATE
  );

