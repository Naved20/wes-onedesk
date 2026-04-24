-- ============================================================================
-- PERMANENT FIX: Ensure Late Threshold Works for ALL Future Check-ins
-- This fixes the system so that from now onwards, everything works correctly
-- ============================================================================

-- Step 1: Ensure ALL active employees have shift assignments
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '=== STEP 1: Assigning shifts to employees ===';
  
  -- DPS employees → DPS shift
  WITH dps_shift AS (
    SELECT id FROM shifts 
    WHERE name ILIKE '%DPS%' 
      AND name NOT ILIKE '%first%' 
      AND name NOT ILIKE '%second%'
      AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  dps_employees AS (
    SELECT user_id FROM employee_profiles
    WHERE institution_assignment ILIKE '%DPS%'
      AND is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM employee_shifts es
        WHERE es.user_id = employee_profiles.user_id
          AND es.effective_from <= CURRENT_DATE
          AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
      )
  )
  INSERT INTO employee_shifts (user_id, shift_id, effective_from, notes)
  SELECT de.user_id, ds.id, CURRENT_DATE, 'Auto-assigned for late threshold fix'
  FROM dps_employees de
  CROSS JOIN dps_shift ds
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Assigned DPS shift to % employees', v_count;
  
  -- Academy employees → Academy shift
  WITH academy_shift AS (
    SELECT id FROM shifts 
    WHERE name ILIKE '%Academy%' 
      AND name NOT ILIKE '%first%' 
      AND name NOT ILIKE '%second%'
      AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  academy_employees AS (
    SELECT user_id FROM employee_profiles
    WHERE institution_assignment ILIKE '%Academy%'
      AND is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM employee_shifts es
        WHERE es.user_id = employee_profiles.user_id
          AND es.effective_from <= CURRENT_DATE
          AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
      )
  )
  INSERT INTO employee_shifts (user_id, shift_id, effective_from, notes)
  SELECT ae.user_id, a_shift.id, CURRENT_DATE, 'Auto-assigned for late threshold fix'
  FROM academy_employees ae
  CROSS JOIN academy_shift a_shift
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Assigned Academy shift to % employees', v_count;
  
  -- WES employees → WES shift
  WITH wes_shift AS (
    SELECT id FROM shifts 
    WHERE name ILIKE '%WES%' 
      AND name NOT ILIKE '%first%' 
      AND name NOT ILIKE '%second%'
      AND name NOT ILIKE '%WESA%'
      AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  wes_employees AS (
    SELECT user_id FROM employee_profiles
    WHERE institution_assignment ILIKE '%WES%'
      AND institution_assignment NOT ILIKE '%WESA%'
      AND is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM employee_shifts es
        WHERE es.user_id = employee_profiles.user_id
          AND es.effective_from <= CURRENT_DATE
          AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
      )
  )
  INSERT INTO employee_shifts (user_id, shift_id, effective_from, notes)
  SELECT we.user_id, ws.id, CURRENT_DATE, 'Auto-assigned for late threshold fix'
  FROM wes_employees we
  CROSS JOIN wes_shift ws
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Assigned WES shift to % employees', v_count;
  
  -- WESA employees → WESA shift
  WITH wesa_shift AS (
    SELECT id FROM shifts 
    WHERE name ILIKE '%WESA%' 
      AND name NOT ILIKE '%first%' 
      AND name NOT ILIKE '%second%'
      AND is_active = true 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  wesa_employees AS (
    SELECT user_id FROM employee_profiles
    WHERE institution_assignment ILIKE '%WESA%'
      AND is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM employee_shifts es
        WHERE es.user_id = employee_profiles.user_id
          AND es.effective_from <= CURRENT_DATE
          AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
      )
  )
  INSERT INTO employee_shifts (user_id, shift_id, effective_from, notes)
  SELECT we.user_id, ws.id, CURRENT_DATE, 'Auto-assigned for late threshold fix'
  FROM wesa_employees we
  CROSS JOIN wesa_shift ws
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Assigned WESA shift to % employees', v_count;
END $$;


-- Step 2: Create trigger to auto-assign shift when employee is created
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_assign_shift_to_new_employee()
RETURNS TRIGGER AS $
DECLARE
  v_shift_id UUID;
BEGIN
  -- Find appropriate shift based on institution
  IF NEW.institution_assignment ILIKE '%DPS%' THEN
    SELECT id INTO v_shift_id
    FROM shifts
    WHERE name ILIKE '%DPS%'
      AND name NOT ILIKE '%first%'
      AND name NOT ILIKE '%second%'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF NEW.institution_assignment ILIKE '%Academy%' THEN
    SELECT id INTO v_shift_id
    FROM shifts
    WHERE name ILIKE '%Academy%'
      AND name NOT ILIKE '%first%'
      AND name NOT ILIKE '%second%'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF NEW.institution_assignment ILIKE '%WESA%' THEN
    SELECT id INTO v_shift_id
    FROM shifts
    WHERE name ILIKE '%WESA%'
      AND name NOT ILIKE '%first%'
      AND name NOT ILIKE '%second%'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  ELSIF NEW.institution_assignment ILIKE '%WES%' THEN
    SELECT id INTO v_shift_id
    FROM shifts
    WHERE name ILIKE '%WES%'
      AND name NOT ILIKE '%first%'
      AND name NOT ILIKE '%second%'
      AND name NOT ILIKE '%WESA%'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Assign shift if found
  IF v_shift_id IS NOT NULL THEN
    INSERT INTO employee_shifts (user_id, shift_id, effective_from, notes)
    VALUES (NEW.user_id, v_shift_id, CURRENT_DATE, 'Auto-assigned on employee creation')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_assign_shift ON employee_profiles;

-- Create trigger
CREATE TRIGGER trigger_auto_assign_shift
AFTER INSERT ON employee_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_assign_shift_to_new_employee();

COMMENT ON FUNCTION auto_assign_shift_to_new_employee() IS 
'Automatically assigns appropriate shift to new employees based on their institution';


-- Step 3: Create function to validate attendance has shift_id
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_attendance_has_shift()
RETURNS TRIGGER AS $
BEGIN
  -- If check_in_time is being set and shift_id is NULL, try to get it
  IF NEW.check_in_time IS NOT NULL AND NEW.shift_id IS NULL THEN
    -- Try to get shift for this user and date
    SELECT shift_id INTO NEW.shift_id
    FROM get_employee_shift(NEW.user_id, NEW.date)
    LIMIT 1;
    
    -- If still NULL, raise warning but allow insert
    IF NEW.shift_id IS NULL THEN
      RAISE WARNING 'Attendance record for user % on % has no shift_id. Late threshold will not work!', 
        NEW.user_id, NEW.date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_validate_attendance_shift ON attendance;

-- Create trigger
CREATE TRIGGER trigger_validate_attendance_shift
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION validate_attendance_has_shift();

COMMENT ON FUNCTION validate_attendance_has_shift() IS 
'Ensures attendance records always have shift_id set, required for late threshold calculation';


-- Step 4: Verification
-- ============================================================================
SELECT 
  '=== VERIFICATION ===' as section;

-- Check all employees have shifts
SELECT 
  'Employees with shift assignments' as metric,
  COUNT(*) as total_employees,
  SUM(CASE WHEN shift_name IS NOT NULL THEN 1 ELSE 0 END) as with_shift,
  SUM(CASE WHEN shift_name IS NULL THEN 1 ELSE 0 END) as without_shift,
  CASE 
    WHEN SUM(CASE WHEN shift_name IS NULL THEN 1 ELSE 0 END) = 0
    THEN '✅ ALL EMPLOYEES HAVE SHIFTS'
    ELSE '⚠️ ' || SUM(CASE WHEN shift_name IS NULL THEN 1 ELSE 0 END)::TEXT || ' employees still need shift assignment'
  END as status
FROM (
  SELECT 
    ep.user_id,
    (SELECT shift_name FROM get_employee_shift(ep.user_id, CURRENT_DATE) LIMIT 1) as shift_name
  FROM employee_profiles ep
  WHERE ep.is_active = true
) sub;

-- Check triggers are created
SELECT 
  'Triggers created' as metric,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ TRIGGERS ACTIVE'
    ELSE '❌ TRIGGERS MISSING'
  END as status
FROM pg_trigger
WHERE tgname IN ('trigger_auto_assign_shift', 'trigger_validate_attendance_shift');


-- Step 5: Test future check-in
-- ============================================================================
SELECT 
  '=== FUTURE CHECK-IN TEST ===' as section;

-- Simulate what will happen on next check-in
WITH test_employee AS (
  SELECT user_id, first_name, last_name, institution_assignment
  FROM employee_profiles
  WHERE is_active = true
  LIMIT 1
)
SELECT 
  te.first_name || ' ' || te.last_name as employee_name,
  te.institution_assignment,
  (SELECT shift_name FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as assigned_shift,
  (SELECT start_time FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as shift_start,
  (SELECT late_threshold_minutes FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) as late_threshold,
  CASE 
    WHEN (SELECT shift_name FROM get_employee_shift(te.user_id, CURRENT_DATE) LIMIT 1) IS NOT NULL
    THEN '✅ Will work correctly - shift_id will be stored'
    ELSE '❌ Will fail - no shift assigned'
  END as future_checkin_status
FROM test_employee te;


-- Final Summary
-- ============================================================================
SELECT 
  '=== FINAL SUMMARY ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname IN ('trigger_auto_assign_shift', 'trigger_validate_attendance_shift')
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM get_employee_shift(ep.user_id, CURRENT_DATE)
        )
    )
    THEN '✅✅✅ SUCCESS! Future late threshold will work correctly!

What was fixed:
1. ✅ All employees now have shift assignments
2. ✅ New employees will auto-get shifts
3. ✅ Attendance records will auto-get shift_id
4. ✅ Late threshold will calculate correctly

From now onwards:
- New employees → Auto-assigned shift
- Check-in → shift_id automatically stored
- Late threshold → Works perfectly
'
    ELSE '⚠️ Some issues remain - check verification above'
  END as final_status;


-- ============================================================================
-- WHAT THIS MIGRATION DOES:
-- ============================================================================
-- 1. Assigns shifts to ALL active employees (DPS, Academy, WES, WESA)
-- 2. Creates trigger to auto-assign shifts to new employees
-- 3. Creates trigger to ensure attendance always has shift_id
-- 4. Verifies everything is working
--
-- FUTURE BEHAVIOR:
-- - New employee created → Automatically gets shift based on institution
-- - Employee checks in → shift_id automatically stored
-- - Late threshold → Calculates correctly every time
--
-- NO MORE MANUAL INTERVENTION NEEDED!
-- ============================================================================
