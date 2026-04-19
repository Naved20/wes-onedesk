-- ============================================================================
-- VERIFY: Auto-Absent System is Working
-- Run this to check if the auto-absent system is properly configured
-- ============================================================================

-- Step 1: Check if pg_cron extension is enabled
-- ============================================================================
SELECT 
  '=== STEP 1: Check pg_cron Extension ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ pg_cron extension is ENABLED'
    ELSE '❌ pg_cron extension is NOT ENABLED - Run enable_auto_absent_cron.sql'
  END as status;


-- Step 2: Check if cron job is scheduled
-- ============================================================================
SELECT 
  '=== STEP 2: Check Cron Job ===' as section;

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE 
    WHEN active THEN '✅ Cron job is ACTIVE'
    ELSE '❌ Cron job is INACTIVE'
  END as status
FROM cron.job
WHERE jobname = 'auto-create-absent-records';

-- If no rows returned, cron job is not created
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records')
    THEN '❌ Cron job NOT FOUND - Run enable_auto_absent_cron.sql'
    ELSE '✅ Cron job exists'
  END as job_status;


-- Step 3: Check cron job execution history (last 10 runs)
-- ============================================================================
SELECT 
  '=== STEP 3: Cron Job Execution History ===' as section;

SELECT 
  runid,
  jobid,
  start_time,
  end_time,
  status,
  return_message,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Success'
    WHEN status = 'failed' THEN '❌ Failed'
    ELSE '⏳ ' || status
  END as result
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records')
ORDER BY start_time DESC
LIMIT 10;


-- Step 4: Test the function manually
-- ============================================================================
SELECT 
  '=== STEP 4: Test Function Manually ===' as section;

-- Check if function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'create_absent_records_for_date'
    )
    THEN '✅ Function create_absent_records_for_date EXISTS'
    ELSE '❌ Function NOT FOUND'
  END as function_status;

-- Test function with today's date (dry run - just check, don't create)
SELECT 
  '=== Testing function with today ===' as test_section;

SELECT 
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.name as shift_name,
  (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as last_checkin_deadline,
  NOW() as current_time,
  CASE 
    WHEN NOW() >= (CURRENT_DATE + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL
    THEN '❌ Should be marked ABSENT'
    ELSE '⏳ Still within check-in time'
  END as status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM attendance WHERE user_id = ep.user_id AND date = CURRENT_DATE)
    THEN '✅ Already has attendance'
    ELSE '🔴 No attendance record'
  END as attendance_status
FROM employee_profiles ep
JOIN employee_shifts es ON ep.user_id = es.user_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
JOIN shifts s ON es.shift_id = s.id
WHERE ep.is_active = true
ORDER BY last_checkin_deadline;


-- Step 5: Check shift configurations
-- ============================================================================
SELECT 
  '=== STEP 5: Shift Configurations ===' as section;

SELECT 
  s.name as shift_name,
  s.start_time,
  s.end_time,
  s.last_checkin_hours_before_end,
  (s.end_time::TIME - (s.last_checkin_hours_before_end || ' hours')::INTERVAL) as last_checkin_time,
  CASE 
    WHEN s.last_checkin_hours_before_end > 0 
    THEN '✅ Configured correctly'
    ELSE '⚠️ No deadline set'
  END as config_status,
  COUNT(DISTINCT es.user_id) as employees_assigned
FROM shifts s
LEFT JOIN employee_shifts es ON s.id = es.shift_id
  AND es.effective_from <= CURRENT_DATE
  AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
WHERE s.is_active = true
GROUP BY s.id, s.name, s.start_time, s.end_time, s.last_checkin_hours_before_end
ORDER BY s.start_time;


-- Step 6: Final System Status
-- ============================================================================
SELECT 
  '=== FINAL SYSTEM STATUS ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
         AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
         AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_absent_records_for_date')
    THEN '✅✅✅ AUTO-ABSENT SYSTEM IS FULLY OPERATIONAL ✅✅✅'
    ELSE '❌ System is NOT fully configured - Check steps above'
  END as final_status;


-- Step 7: Next Scheduled Run
-- ============================================================================
SELECT 
  '=== STEP 7: Next Scheduled Run ===' as section;

SELECT 
  jobname,
  schedule,
  CASE 
    WHEN schedule = '0 * * * *' THEN 'Every hour at minute 0'
    ELSE schedule
  END as schedule_description,
  (SELECT MAX(end_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run,
  (SELECT MAX(end_time) FROM cron.job_run_details WHERE jobid = j.jobid) + INTERVAL '1 hour' as next_run_estimate
FROM cron.job j
WHERE jobname = 'auto-create-absent-records';


-- ============================================================================
-- INTERPRETATION GUIDE:
-- ============================================================================
-- ✅ All green checkmarks = System is working perfectly
-- ❌ Red X marks = Something needs to be fixed
-- ⏳ Clock = Waiting/In progress
-- ⚠️ Warning = Check configuration
--
-- If you see "❌ pg_cron extension is NOT ENABLED":
--   → Run: enable_auto_absent_cron.sql
--
-- If you see "❌ Cron job NOT FOUND":
--   → Run: enable_auto_absent_cron.sql
--
-- If you see "❌ Failed" in execution history:
--   → Check return_message for error details
--   → May need to fix function or permissions
--
-- If everything is ✅ but no absent records are created:
--   → Check if current time has passed the last_checkin_deadline
--   → Manually test: SELECT * FROM trigger_absent_records_now();
-- ============================================================================
