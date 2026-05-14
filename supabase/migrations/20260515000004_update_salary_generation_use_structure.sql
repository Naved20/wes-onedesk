-- =====================================================
-- UPDATE SALARY GENERATION TO USE SALARY STRUCTURES
-- =====================================================

-- Update generate_monthly_salaries to use salary_structures table
CREATE OR REPLACE FUNCTION public.generate_monthly_salaries(p_year integer, p_month integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_working_days INTEGER;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_employee RECORD;
  v_salary_structure RECORD;
  v_attendance_stats JSON;
  v_present_days NUMERIC;
  v_paid_leave_days NUMERIC;
  v_per_day_salary NUMERIC;
  v_basic_earned NUMERIC;
  v_hra_earned NUMERIC;
  v_other_earned NUMERIC;
  v_gross_salary NUMERIC;
  v_epf_employee NUMERIC;
  v_esic_employee NUMERIC;
  v_total_deductions NUMERIC;
  v_net_salary NUMERIC;
BEGIN
  -- Calculate working days for the month
  v_working_days := calculate_monthly_working_days(p_year, p_month);
  
  -- Loop through all active employees
  FOR v_employee IN 
    SELECT user_id, first_name, last_name
    FROM employee_profiles
    WHERE is_active = true
  LOOP
    -- Check if salary record already exists
    IF EXISTS (
      SELECT 1 FROM salaries 
      WHERE user_id = v_employee.user_id 
        AND month = p_month 
        AND year = p_year
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Get active salary structure for this employee
    SELECT * INTO v_salary_structure
    FROM salary_structures
    WHERE user_id = v_employee.user_id
      AND is_active = true
    LIMIT 1;
    
    -- Skip if no salary structure configured
    IF NOT FOUND THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Get attendance stats
    v_attendance_stats := calculate_attendance_stats(v_employee.user_id, p_year, p_month);
    v_present_days := COALESCE((v_attendance_stats->>'present_days')::NUMERIC, 0) + 
                      COALESCE((v_attendance_stats->>'half_days')::NUMERIC, 0) * 0.5;
    v_paid_leave_days := COALESCE((v_attendance_stats->>'casual_leaves')::NUMERIC, 0);
    
    -- Calculate per day salary
    v_per_day_salary := CASE 
      WHEN v_working_days > 0 THEN ROUND(v_salary_structure.fixed_gross_salary / v_working_days, 2) 
      ELSE 0 
    END;
    
    -- Calculate earned amounts based on attendance
    v_basic_earned := ROUND(v_per_day_salary * (v_present_days + v_paid_leave_days) * 
                           (v_salary_structure.basic_percentage / 100), 2);
    v_hra_earned := ROUND(v_basic_earned * (v_salary_structure.hra_percentage / 100), 2);
    v_other_earned := ROUND(v_per_day_salary * (v_present_days + v_paid_leave_days), 2) - 
                      v_basic_earned - v_hra_earned;
    
    -- Calculate gross salary
    v_gross_salary := v_basic_earned + v_hra_earned + v_other_earned;
    
    -- Calculate deductions
    v_epf_employee := CASE 
      WHEN v_salary_structure.epf_applicable THEN ROUND(v_basic_earned * 0.12, 2)
      ELSE 0 
    END;
    
    v_esic_employee := CASE 
      WHEN v_salary_structure.esic_applicable THEN ROUND(v_gross_salary * 0.0075, 2)
      ELSE 0 
    END;
    
    v_total_deductions := v_epf_employee + v_esic_employee;
    
    -- Calculate net salary
    v_net_salary := v_gross_salary - v_total_deductions;
    
    -- Create salary record
    INSERT INTO salaries (
      user_id,
      month,
      year,
      base_salary,
      working_days,
      present_days,
      paid_leave_days,
      absent_days,
      per_day_salary,
      hra_amount,
      travel_allowance,
      special_bonus,
      pf_deduction,
      tds_deduction,
      professional_tax,
      other_deductions,
      gross_salary,
      net_salary_calculated,
      final_salary,
      approval_status,
      is_locked
    ) VALUES (
      v_employee.user_id,
      p_month,
      p_year,
      v_salary_structure.fixed_gross_salary,
      v_working_days,
      v_present_days,
      v_paid_leave_days,
      GREATEST(0, v_working_days - v_present_days - v_paid_leave_days),
      v_per_day_salary,
      v_hra_earned,
      0,  -- Travel allowance (can be added manually)
      0,  -- Special bonus (can be added manually)
      v_epf_employee,
      0,  -- TDS (can be added manually)
      0,  -- Professional tax (can be added manually)
      0,  -- Other deductions (can be added manually)
      v_gross_salary,
      v_net_salary,
      v_net_salary,
      'draft',
      false
    );
    
    v_created_count := v_created_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'created', v_created_count,
    'skipped', v_skipped_count,
    'working_days', v_working_days,
    'message', 'Salary records generated from salary structures'
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION generate_monthly_salaries IS 'Generates monthly salary records using salary_structures table and attendance data';
