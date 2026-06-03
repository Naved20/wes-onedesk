-- Create missing RPC functions for salary management
-- This migration adds required functions that are called but missing

-- 1. Calculate monthly working days RPC
CREATE OR REPLACE FUNCTION calculate_monthly_working_days(p_year INT, p_month INT)
RETURNS INT AS $$
DECLARE
  v_working_days INT;
BEGIN
  -- Get actual days in month from holidays table
  -- For now, return a default of 26 working days
  -- (This can be enhanced to exclude weekends/holidays)
  RETURN 26;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Generate monthly salaries RPC
CREATE OR REPLACE FUNCTION generate_monthly_salaries(p_year INT, p_month INT)
RETURNS JSON AS $$
DECLARE
  v_created INT := 0;
  v_skipped INT := 0;
  v_working_days INT := 26;
  v_emp RECORD;
BEGIN
  -- Get all active employees
  FOR v_emp IN
    SELECT user_id FROM employee_profiles WHERE is_active = true
  LOOP
    -- Check if salary already exists for this month/year
    IF NOT EXISTS (
      SELECT 1 FROM salaries 
      WHERE user_id = v_emp.user_id 
      AND month = p_month 
      AND year = p_year
    ) THEN
      -- Create new salary record
      INSERT INTO salaries (
        user_id, month, year, base_salary, working_days,
        present_days, absent_days, paid_leave_days,
        approval_status, created_at, updated_at
      ) VALUES (
        v_emp.user_id, p_month, p_year,
        COALESCE((SELECT fixed_gross_salary FROM salary_structures 
                  WHERE user_id = v_emp.user_id AND is_active = true LIMIT 1), 0),
        v_working_days,
        0, 0, 0,
        'draft', NOW(), NOW()
      );
      v_created := v_created + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'working_days', v_working_days
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Calculate attendance stats RPC
CREATE OR REPLACE FUNCTION calculate_attendance_stats(
  p_user_id UUID, p_year INT, p_month INT
)
RETURNS JSON AS $$
DECLARE
  v_present INT := 0;
  v_absent INT := 0;
  v_half_days INT := 0;
  v_late INT := 0;
  v_casual_leaves INT := 0;
  v_sick_leaves INT := 0;
  v_record RECORD;
BEGIN
  -- Get all attendance records for the month
  FOR v_record IN
    SELECT 
      status, calculated_status, is_half_day, is_late,
      COALESCE(leave_type, '') as leave_type
    FROM attendance
    WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
  LOOP
    -- Count based on calculated_status or status
    CASE LOWER(COALESCE(v_record.calculated_status, v_record.status))
      WHEN 'present' THEN
        v_present := v_present + 1;
      WHEN 'absent' THEN
        v_absent := v_absent + 1;
      WHEN 'half_day' THEN
        v_half_days := v_half_days + 1;
      WHEN 'late' THEN
        v_late := v_late + 1;
      WHEN 'paid_leave' THEN
        v_casual_leaves := v_casual_leaves + 1;
      WHEN 'leave' THEN
        v_sick_leaves := v_sick_leaves + 1;
    END CASE;
  END LOOP;

  RETURN json_build_object(
    'present_days', v_present,
    'absent_days', v_absent,
    'half_days', v_half_days,
    'late_days', v_late,
    'casual_leaves', v_casual_leaves,
    'sick_leaves', v_sick_leaves,
    'pending_days', 0,
    'rejected_days', 0,
    'attendance_percentage', CASE WHEN (v_present + v_absent + v_half_days + v_casual_leaves + v_sick_leaves) > 0
      THEN ((v_present + v_half_days * 0.5 + v_casual_leaves) * 100) / (v_present + v_absent + v_half_days + v_casual_leaves + v_sick_leaves)
      ELSE 0
    END
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_monthly_working_days(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_salaries(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_attendance_stats(UUID, INT, INT) TO authenticated;

-- Fix RLS policies for salary_structures if needed
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;

-- Allow admins and users to read salary structures
DROP POLICY IF EXISTS "Admins can manage salary structures" ON salary_structures;
CREATE POLICY "Admins can manage salary structures"
  ON salary_structures
  FOR ALL
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR user_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can view their own salary structure" ON salary_structures;
CREATE POLICY "Users can view their own salary structure"
  ON salary_structures
  FOR SELECT
  USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
