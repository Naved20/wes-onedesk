-- Check current Academy shift configuration
SELECT 
  name,
  start_time,
  end_time,
  late_threshold_minutes,
  (start_time::TIME + (late_threshold_minutes || ' minutes')::INTERVAL) as late_cutoff_time,
  half_day_threshold_hours,
  last_checkin_hours_before_end,
  is_active,
  created_at,
  updated_at
FROM shifts
WHERE name ILIKE '%academy%'
ORDER BY name;

-- Check how many employees are assigned to Academy shifts
SELECT 
  s.name as shift_name,
  COUNT(DISTINCT es.user_id) as employees_assigned,
  MIN(es.effective_from) as earliest_assignment,
  MAX(es.effective_from) as latest_assignment
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.name ILIKE '%academy%'
GROUP BY s.id, s.name;
