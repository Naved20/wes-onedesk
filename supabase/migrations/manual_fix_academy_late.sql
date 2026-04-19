-- MANUAL FIX: Academy shift ke is_late flags ko sahi karo
-- Tum ye query run kar sakte ho jab chahoge

-- Step 1: Dekho kitne records change honge (DRY RUN)
SELECT 
  a.date,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  a.check_in_time,
  (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time as checkin_ist_time,
  s.start_time,
  (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval) as late_cutoff,
  a.is_late as current_is_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time 
         > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval)
    THEN true
    ELSE false
  END as correct_is_late,
  CASE 
    WHEN (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time 
         > (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval)
    THEN 'No change needed'
    ELSE 'Will change: true → false'
  END as action
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE s.name = 'Academy'
  AND a.date >= '2026-04-01'
  AND a.date < '2026-05-01'
  AND a.check_in_time IS NOT NULL
  AND a.is_late = true  -- Sirf jo late marked hain
ORDER BY a.date, a.check_in_time;


-- Step 2: Actual fix (jab ready ho tab run karo)
-- Academy shift ke false late flags ko remove karo
UPDATE attendance a
SET 
  is_late = false,
  updated_at = NOW()
FROM employee_shifts es
JOIN shifts s ON es.shift_id = s.id
WHERE a.user_id = es.user_id
  AND s.name = 'Academy'
  AND a.date >= '2026-04-01'
  AND a.date < '2026-05-01'
  AND a.check_in_time IS NOT NULL
  AND a.is_late = true  -- Currently marked late
  -- Only fix if actually on time (IST check-in time <= late cutoff)
  AND (a.check_in_time AT TIME ZONE 'Asia/Kolkata')::time 
      <= (s.start_time::time + (s.late_threshold_minutes || ' minutes')::interval);


-- Step 3: Verify the fix
SELECT 
  'Academy Shift - After Fix' as status,
  COUNT(*) as total_checkins,
  SUM(CASE WHEN is_late THEN 1 ELSE 0 END) as late_count,
  SUM(CASE WHEN NOT is_late THEN 1 ELSE 0 END) as on_time_count,
  ROUND(
    (SUM(CASE WHEN NOT is_late THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100), 2
  ) as on_time_percentage
FROM attendance a
JOIN employee_shifts es ON a.user_id = es.user_id
JOIN shifts s ON es.shift_id = s.id
WHERE s.name = 'Academy'
  AND a.date >= '2026-04-01'
  AND a.date < '2026-05-01'
  AND a.check_in_time IS NOT NULL;
