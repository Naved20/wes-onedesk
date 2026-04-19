-- ============================================================================
-- ENABLE AUTO-ABSENT CRON JOB
-- This will automatically mark employees absent after shift deadline passes
-- ============================================================================

-- Step 1: Enable pg_cron extension (if not already enabled)
-- ============================================================================
-- Note: This requires superuser privileges
-- Run this in Supabase SQL Editor with admin access
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- Step 2: Create the cron job to run every hour
-- ============================================================================
-- This will check every hour and create absent records for employees
-- who haven't checked in after their shift's last check-in deadline

SELECT cron.schedule(
  'auto-create-absent-records',
  '0 * * * *', -- Run every hour at minute 0
  $$SELECT create_absent_records_for_date(CURRENT_DATE)$$
);


-- Step 3: Verify the cron job was created
-- ============================================================================
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'auto-create-absent-records';


-- ============================================================================
-- WHAT THIS DOES:
-- ============================================================================
-- Every hour, the system will:
-- 1. Check all active employees
-- 2. Find employees who haven't checked in today
-- 3. Check if their shift's last check-in deadline has passed
-- 4. Automatically create ABSENT records for those employees
--
-- Example:
-- - DPS Shift: 08:10 - 15:10, last_checkin_hours_before_end = 3.5
-- - Last check-in deadline = 15:10 - 3.5 hours = 11:40 AM
-- - If employee hasn't checked in by 11:40 AM, they'll be marked ABSENT
--
-- - Academy Shift: 13:00 - 19:00, last_checkin_hours_before_end = 3.5
-- - Last check-in deadline = 19:00 - 3.5 hours = 15:30 PM (3:30 PM)
-- - If employee hasn't checked in by 3:30 PM, they'll be marked ABSENT
-- ============================================================================


-- ============================================================================
-- TROUBLESHOOTING:
-- ============================================================================
-- If cron job doesn't work:
-- 1. Check if pg_cron extension is enabled:
--    SELECT * FROM pg_extension WHERE extname = 'pg_cron';
--
-- 2. Check cron job status:
--    SELECT * FROM cron.job;
--
-- 3. Check cron job history:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- 4. Manually trigger for testing:
--    SELECT * FROM trigger_absent_records_now();
-- ============================================================================
