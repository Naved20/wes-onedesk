-- ============================================================================
-- DAILY MONITORING: Auto-Absent System
-- Run this daily to monitor if auto-absent is working correctly
-- ============================================================================

-- Quick Status Check
-- ============================================================================
SELECT 
  '📊 AUTO-ABSENT SYSTEM - DAILY REPORT' as report_title,
  CURRENT_DATE as report_date,
  (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as current_ist_time;


-- 1. Today's Absent Records (Auto-created)
-- ============================================================================
SELECT 
  '=== 1. Auto-Created Absent Records Today ===' as section;

SELECT 
  COUNT(*) as total_auto_absent,
  MIN(a.created_at) as first_created_at,
  MAX(a.created_at) as last_created_at
FROM attendance a
WHERE a.date = CURRENT_DATE
  AND a.calculated_status = 'absent'
  AND a.notes LIKE '%Auto-marked%';

-- Details
SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  a.notes,
  a.created_at
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
LEFT JOIN shifts s ON a.shift_id = s.id
WHERE a.date = CURRENT_DATE
  AND a.calculated_status = 'absent'
  AND a.notes LIKE '%Auto-marked%'
ORDER BY a.created_at;


-- 2. Employees Still Without Attendance (Pending Absent)
-- ============================================================================
SELECT 
  '=== 2. Employees Without Attendance Today ===' as section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  ep.institution_assignment,
  s.name as shift_name,
  s.start_time,
  s.end_time,
  (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  CASE 
    WHEN NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
    THEN '❌ Deadline passed - Should be ABSENT'
    ELSE '⏳ Still within check-in time (' || 
         EXTRACT(HOUR FROM ((CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL - NOW())) || 'h ' ||
         EXTRACT(MINUTE FROM ((CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL - NOW())) || 'm remaining)'
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


-- 3. Cron Job Status (Last 24 hours)
-- ============================================================================
SELECT 
  '=== 3. Cron Job Executions (Last 24 Hours) ===' as section;

SELECT 
  start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as execution_time_ist,
  status,
  return_message,
  (end_time - start_time) as duration,
  CASE 
    WHEN status = 'succeeded' THEN '✅'
    WHEN status = 'failed' THEN '❌'
    ELSE '⏳'
  END as result
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records')
  AND start_time >= NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC;


-- 4. Summary Statistics
-- ============================================================================
SELECT 
  '=== 4. Summary Statistics ===' as section;

WITH stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE calculated_status = 'present' OR calculated_status = 'late') as present_count,
    COUNT(*) FILTER (WHERE calculated_status = 'absent') as absent_count,
    COUNT(*) FILTER (WHERE calculated_status = 'half_day') as half_day_count,
    COUNT(*) FILTER (WHERE calculated_status = 'absent' AND notes LIKE '%Auto-marked%') as auto_absent_count,
    COUNT(*) FILTER (WHERE calculated_status = 'absent' AND notes NOT LIKE '%Auto-marked%') as manual_absent_count
  FROM attendance
  WHERE date = CURRENT_DATE
),
employee_stats AS (
  SELECT COUNT(*) as total_active_employees
  FROM employee_profiles
  WHERE is_active = true
)
SELECT 
  e.total_active_employees,
  s.present_count,
  s.absent_count,
  s.half_day_count,
  s.auto_absent_count,
  s.manual_absent_count,
  (e.total_active_employees - (s.present_count + s.absent_count + s.half_day_count)) as no_attendance_yet,
  ROUND(100.0 * s.present_count / NULLIF(e.total_active_employees, 0), 2) as present_percentage,
  ROUND(100.0 * s.absent_count / NULLIF(e.total_active_employees, 0), 2) as absent_percentage
FROM stats s, employee_stats e;


-- 5. Health Check
-- ============================================================================
SELECT 
  '=== 5. System Health Check ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
    THEN '✅ Cron job is active'
    ELSE '❌ Cron job is NOT active'
  END as cron_status,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details 
      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records')
        AND start_time >= NOW() - INTERVAL '2 hours'
        AND status = 'succeeded'
    )
    THEN '✅ Cron ran successfully in last 2 hours'
    ELSE '⚠️ No successful run in last 2 hours'
  END as recent_execution,
  
  CASE 
    WHEN (
      SELECT COUNT(*) FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = CURRENT_DATE)
        AND EXISTS (
          SELECT 1 FROM employee_shifts es
          JOIN shifts s ON es.shift_id = s.id
          WHERE es.user_id = ep.user_id
            AND es.effective_from <= CURRENT_DATE
            AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
            AND NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
        )
    ) = 0
    THEN '✅ All eligible employees marked absent'
    ELSE '⚠️ ' || (
      SELECT COUNT(*) FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = CURRENT_DATE)
        AND EXISTS (
          SELECT 1 FROM employee_shifts es
          JOIN shifts s ON es.shift_id = s.id
          WHERE es.user_id = ep.user_id
            AND es.effective_from <= CURRENT_DATE
            AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
            AND NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
        )
    )::TEXT || ' employees should be marked absent but are not'
  END as absent_marking_status;


-- 6. Recommendations
-- ============================================================================
SELECT 
  '=== 6. Recommendations ===' as section;

SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
    THEN '❌ ACTION REQUIRED: Enable cron job by running enable_auto_absent_cron.sql'
    
    WHEN EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = CURRENT_DATE)
        AND EXISTS (
          SELECT 1 FROM employee_shifts es
          JOIN shifts s ON es.shift_id = s.id
          WHERE es.user_id = ep.user_id
            AND es.effective_from <= CURRENT_DATE
            AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
            AND NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
        )
    )
    THEN '⚠️ ACTION SUGGESTED: Run manual_trigger_absent_today.sql to mark pending absents'
    
    ELSE '✅ System is working perfectly! No action needed.'
  END as recommendation;


-- ============================================================================
-- HOW TO USE THIS REPORT:
-- ============================================================================
-- Run this query daily (preferably at end of day) to monitor:
-- 1. How many employees were auto-marked absent
-- 2. If any employees are pending absent marking
-- 3. If cron job is running successfully
-- 4. Overall attendance statistics
-- 5. System health status
--
-- If you see ❌ or ⚠️ warnings, follow the recommendations provided.
-- ============================================================================
