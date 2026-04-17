-- Add 5 hours 30 minutes to check-in time for Academy shift employees on April 1-11, 2026
-- Date will remain same, only time will increase by 5:30 hours

UPDATE attendance
SET 
  check_in_time = check_in_time + INTERVAL '5 hours 30 minutes',
  updated_at = NOW()
WHERE 
  date >= '2026-04-01'
  AND date <= '2026-04-11'
  AND check_in_time IS NOT NULL
  AND user_id IN (
    SELECT es.user_id 
    FROM employee_shifts es
    JOIN shifts s ON es.shift_id = s.id
    WHERE s.name ILIKE '%academy%'
  );
