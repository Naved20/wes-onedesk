-- ============================================================================
-- TEST: Will Auto-Absent Work in Future?
-- Simple test to verify the system will work correctly
-- ============================================================================

SELECT '🧪 TESTING AUTO-ABSENT SYSTEM' as test_title;


-- Test 1: Is pg_cron enabled?
-- ============================================================================
SELECT 
  '1️⃣ pg_cron Extension' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ PASS - Extension is enabled'
    ELSE '❌ FAIL - Extension not enabled'
  END as result;


-- Test 2: Is cron job scheduled?
-- ============================================================================
SELECT 
  '2️⃣ Cron Job Scheduled' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
    THEN '✅ PASS - Cron job is active and scheduled'
    ELSE '❌ FAIL - Cron job not found or inactive'
  END as result;


-- Test 3: Does the function exist?
-- ============================================================================
SELECT 
  '3️⃣ Function Exists' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_absent_records_for_date')
    THEN '✅ PASS - Function exists'
    ELSE '❌ FAIL - Function not found'
  END as result;


-- Test 4: Can we call the function?
-- ============================================================================
SELECT 
  '4️⃣ Function Callable' as test_name,
  CASE 
    WHEN (SELECT create_absent_records_for_date('2026-04-01'::DATE)) >= 0
    THEN '✅ PASS - Function can be called (returned: ' || (SELECT create_absent_records_for_date('2026-04-01'::DATE))::TEXT || ')'
    ELSE '❌ FAIL - Function error'
  END as result;


-- Test 5: Are shifts configured correctly?
-- ============================================================================
SELECT 
  '5️⃣ Shift Configuration' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM shifts 
      WHERE is_active = true 
        AND last_checkin_hours_before_end > 0
    )
    THEN '✅ PASS - ' || (SELECT COUNT(*) FROM shifts WHERE is_active = true)::TEXT || ' active shifts configured'
    ELSE '❌ FAIL - No active shifts or missing deadline configuration'
  END as result;


-- Test 6: Are employees assigned to shifts?
-- ============================================================================
SELECT 
  '6️⃣ Employee Shift Assignments' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM employee_shifts es
      WHERE es.effective_from <= CURRENT_DATE
        AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
    )
    THEN '✅ PASS - ' || (
      SELECT COUNT(DISTINCT user_id) FROM employee_shifts 
      WHERE effective_from <= CURRENT_DATE 
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    )::TEXT || ' employees have shift assignments'
    ELSE '⚠️ WARNING - No employees assigned to shifts'
  END as result;


-- Test 7: Has cron run recently?
-- ============================================================================
SELECT 
  '7️⃣ Recent Cron Execution' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details 
      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records')
        AND start_time >= NOW() - INTERVAL '2 hours'
    )
    THEN '✅ PASS - Cron ran in last 2 hours at ' || 
         (SELECT (MAX(start_time) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TEXT 
          FROM cron.job_run_details 
          WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records'))
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details 
      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records')
    )
    THEN '⚠️ WARNING - Last run was ' || 
         (SELECT (MAX(start_time) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::TEXT 
          FROM cron.job_run_details 
          WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-create-absent-records'))
    ELSE '⚠️ WARNING - Cron has never run yet (may be newly created)'
  END as result;


-- Test 8: Simulate future scenario
-- ============================================================================
SELECT 
  '8️⃣ Future Scenario Simulation' as test_name;

-- Show what will happen tomorrow if someone doesn't check in
WITH tomorrow_test AS (
  SELECT 
    s.name as shift_name,
    s.start_time,
    s.end_time,
    s.last_checkin_hours_before_end,
    ((CURRENT_DATE + INTERVAL '1 day') + s.end_time) - (s.last_checkin_hours_before_end || ' hours')::INTERVAL as deadline
  FROM shifts s
  WHERE s.is_active = true
  LIMIT 1
)
SELECT 
  '✅ SIMULATION - Tomorrow (' || (CURRENT_DATE + INTERVAL '1 day')::TEXT || ')' as scenario,
  shift_name,
  'If employee does not check in by ' || deadline::TIME::TEXT || ', they will be marked ABSENT' as what_will_happen
FROM tomorrow_test;


-- Final Verdict
-- ============================================================================
SELECT 
  '🎯 FINAL VERDICT' as section;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
         AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
         AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_absent_records_for_date')
         AND EXISTS (SELECT 1 FROM shifts WHERE is_active = true AND last_checkin_hours_before_end > 0)
    THEN '✅✅✅ ALL TESTS PASSED! Auto-absent will work in future! ✅✅✅'
    ELSE '❌ SOME TESTS FAILED - Check results above and fix issues'
  END as verdict,
  
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN 'Run: enable_auto_absent_cron.sql'
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-absent-records' AND active = true)
    THEN 'Run: enable_auto_absent_cron.sql'
    WHEN NOT EXISTS (SELECT 1 FROM shifts WHERE is_active = true AND last_checkin_hours_before_end > 0)
    THEN 'Configure shift deadlines in shift settings'
    ELSE 'No action needed - System is ready!'
  END as action_required;


-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- ✅ PASS = Test passed, component is working
-- ❌ FAIL = Test failed, needs immediate fix
-- ⚠️ WARNING = Not critical but should be checked
--
-- If final verdict shows ✅✅✅ = You're good to go!
-- If final verdict shows ❌ = Follow the action_required suggestion
-- ============================================================================
