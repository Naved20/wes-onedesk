-- =====================================================
-- UPDATE GENERATE_MONTHLY_SALARIES WITH COMPLETE STRUCTURE
-- =====================================================

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
  v_absent_days NUMERIC;
  v_half_days NUMERIC;
  
  -- Salary calculations
  v_per_day_salary NUMERIC;
  v_effective_days NUMERIC;
  v_gross_earned NUMERIC;
  
  -- Fixed components
  v_basic_earned NUMERIC;
  v_hra_earned NUMERIC;
  v_other_allowance_earned NUMERIC;
  
  -- Variable earnings (empty initially)
  v_variable_earnings_total NUMERIC := 0;
  v_total_gross_earnings NUMERIC;
  
  -- Employee deductions
  v_epf_employee NUMERIC;
  v_esic_employee NUMERIC;
  v_total_deductions NUMERIC;
  
  -- Net payable
  v_net_payable NUMERIC;
  
  -- Employer contributions
  v_epf_employer NUMERIC;
  v_esic_employer NUMERIC;
  v_total_employer_contribution NUMERIC;
  
  -- Total CTC
  v_total_ctc NUMERIC;
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
    v_present_days := COALESCE((v_attendance_stats->>'present_days')::NUMERIC, 0);
    v_half_days := COALESCE((v_attendance_stats->>'half_days')::NUMERIC, 0);
    v_paid_leave_days := COALESCE((v_attendance_stats->>'casual_leaves')::NUMERIC, 0);
    
    -- Adjust present days for half days
    v_present_days := v_present_days + (v_half_days * 0.5);
    
    -- Calculate absent days
    v_absent_days := GREATEST(0, v_working_days - v_present_days - v_paid_leave_days);
    
    -- Calculate per day salary
    v_per_day_salary := CASE 
      WHEN v_working_days > 0 THEN ROUND(v_salary_structure.fixed_gross_salary / v_working_days, 2) 
      ELSE 0 
    END;
    
    -- Calculate effective paid days
    v_effective_days := v_present_days + v_paid_leave_days;
    
    -- Calculate gross earned based on attendance
    v_gross_earned := ROUND(v_per_day_salary * v_effective_days, 2);
    
    -- Calculate fixed salary components based on earned amount
    v_basic_earned := ROUND(v_gross_earned * (v_salary_structure.basic_percentage / 100), 2);
    v_hra_earned := ROUND(v_basic_earned * (v_salary_structure.hra_percentage / 100), 2);
    v_other_allowance_earned := ROUND(v_gross_earned * 
                                      (COALESCE(v_salary_structure.other_allowance_percentage, 30) / 100), 2);
    
    -- Total gross earnings (fixed + variable)
    -- Variable earnings will be 0 initially, can be added manually in edit
    v_total_gross_earnings := v_gross_earned + v_variable_earnings_total;
    
    -- Calculate employee deductions
    v_epf_employee := CASE 
      WHEN v_salary_structure.epf_applicable THEN 
        ROUND(v_basic_earned * (COALESCE(v_salary_structure.epf_employee_rate, 12) / 100), 2)
      ELSE 0 
    END;
    
    v_esic_employee := CASE 
      WHEN v_salary_structure.esic_applicable THEN 
        ROUND(v_total_gross_earnings * (COALESCE(v_salary_structure.esic_employee_rate, 0.75) / 100), 2)
      ELSE 0 
    END;
    
    -- Total deductions (manual deductions will be 0, can be added in edit)
    v_total_deductions := v_epf_employee + v_esic_employee;
    
    -- Calculate net payable
    v_net_payable := v_total_gross_earnings - v_total_deductions;
    
    -- Calculate employer contributions
    v_epf_employer := CASE 
      WHEN v_salary_structure.epf_applicable THEN 
        ROUND(v_basic_earned * (COALESCE(v_salary_structure.epf_employer_rate, 12) / 100), 2)
      ELSE 0 
    END;
    
    v_esic_employer := CASE 
      WHEN v_salary_structure.esic_applicable THEN 
        ROUND(v_total_gross_earnings * (COALESCE(v_salary_structure.esic_employer_rate, 3.25) / 100), 2)
      ELSE 0 
    END;
    
    v_total_employer_contribution := v_epf_employer + v_esic_employer;
    
    -- Calculate total CTC
    v_total_ctc := v_total_gross_earnings + v_total_employer_contribution;
    
    -- Create salary record with complete structure
    INSERT INTO salaries (
      user_id,
      month,
      year,
      
      -- From salary_structures
      base_salary,
      
      -- Attendance
      working_days,
      present_days,
      paid_leave_days,
      absent_days,
      
      -- Calculated values
      per_day_salary,
      
      -- Fixed components (NEW COLUMNS)
      basic_earned,
      hra_earned,
      other_allowance_earned,
      
      -- Variable earnings (NEW COLUMNS)
      variable_earnings_details,
      variable_earnings_total,
      
      -- Employee deductions (NEW COLUMNS)
      epf_employee,
      esic_employee,
      manual_deduction,
      tds_deduction,
      professional_tax,
      other_deductions,
      total_deductions,
      
      -- Calculated totals (NEW COLUMNS)
      gross_salary,
      net_salary_calculated,
      final_salary,
      
      -- Employer contributions (NEW COLUMNS)
      epf_employer,
      esic_employer,
      total_employer_contribution,
      total_ctc,
      
      -- Status
      approval_status,
      is_locked
    ) VALUES (
      v_employee.user_id,
      p_month,
      p_year,
      
      -- From salary_structures
      v_salary_structure.fixed_gross_salary,
      
      -- Attendance
      v_working_days,
      v_present_days,
      v_paid_leave_days,
      v_absent_days,
      
      -- Calculated values
      v_per_day_salary,
      
      -- Fixed components
      v_basic_earned,
      v_hra_earned,
      v_other_allowance_earned,
      
      -- Variable earnings (empty initially)
      '{}'::jsonb,
      0,
      
      -- Employee deductions
      v_epf_employee,
      v_esic_employee,
      0,  -- manual_deduction
      0,  -- tds_deduction
      0,  -- professional_tax
      0,  -- other_deductions
      v_total_deductions,
      
      -- Calculated totals
      v_total_gross_earnings,
      v_net_payable,
      v_net_payable,
      
      -- Employer contributions
      v_epf_employer,
      v_esic_employer,
      v_total_employer_contribution,
      v_total_ctc,
      
      -- Status
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
    'message', format('Generated %s salary records with complete breakdown (Fixed + Variable + Deductions + CTC)', v_created_count)
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION generate_monthly_salaries IS 'Generates monthly salary records with complete salary structure breakdown including:
- Fixed components (Basic, HRA, Other Allowance) based on attendance
- Variable earnings (initially empty, can be added in edit)
- Employee deductions (EPF, ESIC, etc.)
- Employer contributions (EPF Employer, ESIC Employer)
- Total CTC calculation
All calculations are based on salary_structures table and attendance data';
