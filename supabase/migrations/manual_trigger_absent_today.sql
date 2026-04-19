-- ============================================================================
-- MANUAL TRIGGER: Mark Absent for Today
-- Run this anytime to manually create absent records for today
-- ============================================================================

-- Option 1: Quick trigger (just create the records)
-- ============================================================================
SELECT * FROM trigger_absent_records_now();


-- Option 2: Detailed view (see who will be marked absent before creating)
-- ============================================================================
SELECT 
  '=== Employees who will be marked ABSENT today ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.last_checkin_hours_before_end,
  (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as current_ist_time,
  CASE 
    WHEN NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
    THEN '❌ Deadline passed - Will be marked ABSENT'
    ELSE '⏳ Still within check-in time'
  END as status
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.user_id = ep.user_id
    AND a.date = CURRENT_DATE
  )
ORDER BY last_checkin_deadline;


-- Then create the absent records
SELECT create_absent_records_for_date(CURRENT_DATE) as records_created;


-- Verify
SELECT 
  '=== Absent records created today ===' as section;

SELECT 
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
