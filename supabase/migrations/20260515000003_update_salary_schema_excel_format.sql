-- =====================================================
-- UPDATE SALARY SCHEMA TO MATCH EXCEL STRUCTURE
-- =====================================================

-- 1. Add missing columns to employee_profiles
ALTER TABLE employee_profiles 
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS program TEXT,
ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'Full-time' CHECK (engagement_type IN ('Full-time', 'Part-time', 'Contract')),
ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'Active' CHECK (employment_status IN ('Active', 'Inactive'));

-- Create index for employee_id
CREATE INDEX IF NOT EXISTS idx_employee_profiles_employee_id ON employee_profiles(employee_id);

-- 2. Update salary_structures table to match Excel formula
-- Drop and recreate with correct HRA calculation
ALTER TABLE salary_structures 
DROP COLUMN IF EXISTS hra_amount CASCADE;

ALTER TABLE salary_structures
ADD COLUMN hra_amount DECIMAL(10, 2) GENERATED ALWAYS AS ((fixed_gross_salary * basic_percentage / 100) * hra_percentage / 100) STORED;

-- Update comment
COMMENT ON COLUMN salary_structures.hra_percentage IS 'HRA as percentage of Basic (typically 40%, which equals 20% of Gross if Basic is 50%)';

-- 3. Update earning_types with exact Excel names
DELETE FROM earning_types WHERE earning_code IN ('LESSON_PLAN', 'ENG_TRAINING', 'DIGITAL_TRAINING');

INSERT INTO earning_types (earning_code, earning_name, description, display_order) VALUES
('LESSON_PLAN', 'Lesson Plan', 'Lesson Plan Incentive', 1),
('ENG_TRAINING', 'ENG Training Task', 'English Training Task Incentive', 2),
('DIGITAL_TRAINING', 'Digital Training Task', 'Digital Training Task Incentive', 3),
('TRAVEL_ALLOWANCE', 'Travel Allowance', 'Travel Allowance', 4),
('SPECIAL_BONUS', 'Special Bonus', 'Special Bonus', 5),
('PERFORMANCE_BONUS', 'Performance Bonus', 'Monthly performance bonus', 6),
('ATTENDANCE_BONUS', 'Attendance Bonus', 'Bonus for full attendance', 7),
('OTHER_INCENTIVE', 'Other Incentive', 'Other miscellaneous incentives', 99)
ON CONFLICT (earning_code) DO UPDATE SET
  earning_name = EXCLUDED.earning_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 4. Update deduction_types with exact Excel names
DELETE FROM deduction_types WHERE deduction_code IN ('EPF', 'ESIC', 'LOAN', 'ADVANCE', 'OTHER');

INSERT INTO deduction_types (deduction_code, deduction_name, description, is_statutory, display_order) VALUES
('PF', 'PF Deduction (12%)', 'Employee Provident Fund - 12% of Basic', true, 1),
('ESIC', 'ESIC Deduction', 'Employee State Insurance - 0.75% of Gross', true, 2),
('TDS', 'TDS Deduction', 'Tax Deducted at Source', true, 3),
('PROFESSIONAL_TAX', 'Professional Tax', 'Professional Tax', true, 4),
('LOAN', 'Loan Deduction', 'Loan repayment deduction', false, 5),
('ADVANCE', 'Advance Deduction', 'Salary advance deduction', false, 6),
('OTHER', 'Other Deductions', 'Other miscellaneous deductions', false, 99)
ON CONFLICT (deduction_code) DO UPDATE SET
  deduction_name = EXCLUDED.deduction_name,
  description = EXCLUDED.description,
  is_statutory = EXCLUDED.is_statutory,
  display_order = EXCLUDED.display_order;

-- 5. Add EPF and ESIC rates to salary_structures (update defaults)
ALTER TABLE salary_structures 
ALTER COLUMN epf_employee_rate SET DEFAULT 12.00,
ALTER COLUMN epf_employer_rate SET DEFAULT 12.00,
ALTER COLUMN esic_employee_rate SET DEFAULT 0.75,
ALTER COLUMN esic_employer_rate SET DEFAULT 3.25;

-- 6. Update payroll_register to include all Excel columns
ALTER TABLE payroll_register
ADD COLUMN IF NOT EXISTS engagement_type TEXT,
ADD COLUMN IF NOT EXISTS employment_status TEXT,
ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS program TEXT,
ADD COLUMN IF NOT EXISTS payslip_remarks TEXT;

-- Add calculated columns for clarity
COMMENT ON COLUMN payroll_register.basic_earned IS 'Basic salary earned based on paid days (50% of gross earned)';
COMMENT ON COLUMN payroll_register.hra_earned IS 'HRA earned (40% of basic earned = 20% of gross earned)';
COMMENT ON COLUMN payroll_register.other_allowance_earned IS 'Other allowance (30% of gross earned)';

-- 7. Create view for easy payroll register display (Excel format)
CREATE OR REPLACE VIEW payroll_register_view AS
SELECT 
  pr.id,
  TO_CHAR(pr.payroll_month, 'Mon-YYYY') as payroll_month_display,
  pr.payroll_month,
  ep.employee_id,
  CONCAT(ep.first_name, ' ', ep.last_name) as employee_name,
  ep.program,
  ep.department,
  ep.designation,
  ep.engagement_type,
  ep.employment_status as status,
  ss.fixed_gross_salary as gross_monthly_salary,
  pr.payroll_days,
  pr.paid_days as paid_day_units,
  pr.daily_rate,
  pr.fixed_gross_earned as gross_earned,
  pr.basic_earned,
  pr.hra_earned,
  pr.other_allowance_earned,
  pr.variable_earnings_details,
  pr.variable_earnings_total,
  pr.manual_deductions_details,
  pr.manual_deductions_total,
  ss.epf_applicable as epf_eligible,
  ss.esic_applicable as esic_eligible,
  pr.basic_earned as epf_wage_base,
  pr.epf_employee,
  pr.epf_employer,
  pr.esic_employee,
  pr.esic_employer,
  pr.total_deductions as gross_deductions,
  pr.net_payable,
  pr.total_ctc as employer_total_cost,
  pr.remarks,
  pr.status as payroll_status,
  pr.approved_by,
  pr.approved_at,
  pr.paid_date,
  CONCAT(TO_CHAR(pr.payroll_month, 'Mon-YYYY'), '|', ep.employee_id) as record_key
FROM payroll_register pr
JOIN employee_profiles ep ON pr.user_id = ep.user_id
LEFT JOIN salary_structures ss ON pr.user_id = ss.user_id AND ss.is_active = true
ORDER BY pr.payroll_month DESC, ep.employee_id;

-- Grant access to view
GRANT SELECT ON payroll_register_view TO authenticated;

-- 8. Create function to calculate salary (Excel logic)
CREATE OR REPLACE FUNCTION calculate_salary_components(
  p_gross_monthly_salary DECIMAL,
  p_payroll_days INTEGER,
  p_paid_days DECIMAL,
  p_basic_percentage DECIMAL DEFAULT 50.00,
  p_hra_percentage DECIMAL DEFAULT 40.00
)
RETURNS TABLE (
  daily_rate DECIMAL,
  gross_earned DECIMAL,
  basic_earned DECIMAL,
  hra_earned DECIMAL,
  other_allowance_earned DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(p_gross_monthly_salary / p_payroll_days, 2) as daily_rate,
    ROUND((p_gross_monthly_salary / p_payroll_days) * p_paid_days, 2) as gross_earned,
    ROUND(((p_gross_monthly_salary / p_payroll_days) * p_paid_days) * (p_basic_percentage / 100), 2) as basic_earned,
    ROUND(((p_gross_monthly_salary / p_payroll_days) * p_paid_days) * (p_basic_percentage / 100) * (p_hra_percentage / 100), 2) as hra_earned,
    ROUND(
      ((p_gross_monthly_salary / p_payroll_days) * p_paid_days) - 
      (((p_gross_monthly_salary / p_payroll_days) * p_paid_days) * (p_basic_percentage / 100)) -
      (((p_gross_monthly_salary / p_payroll_days) * p_paid_days) * (p_basic_percentage / 100) * (p_hra_percentage / 100)),
      2
    ) as other_allowance_earned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Create function to calculate EPF and ESIC
CREATE OR REPLACE FUNCTION calculate_statutory_deductions(
  p_basic_earned DECIMAL,
  p_gross_earned DECIMAL,
  p_epf_applicable BOOLEAN DEFAULT true,
  p_esic_applicable BOOLEAN DEFAULT true,
  p_epf_rate DECIMAL DEFAULT 12.00,
  p_esic_employee_rate DECIMAL DEFAULT 0.75,
  p_esic_employer_rate DECIMAL DEFAULT 3.25
)
RETURNS TABLE (
  epf_employee DECIMAL,
  epf_employer DECIMAL,
  esic_employee DECIMAL,
  esic_employer DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN p_epf_applicable THEN ROUND(p_basic_earned * (p_epf_rate / 100), 2) ELSE 0 END as epf_employee,
    CASE WHEN p_epf_applicable THEN ROUND(p_basic_earned * (p_epf_rate / 100), 2) ELSE 0 END as epf_employer,
    CASE WHEN p_esic_applicable THEN ROUND(p_gross_earned * (p_esic_employee_rate / 100), 2) ELSE 0 END as esic_employee,
    CASE WHEN p_esic_applicable THEN ROUND(p_gross_earned * (p_esic_employer_rate / 100), 2) ELSE 0 END as esic_employer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Add comments for clarity
COMMENT ON FUNCTION calculate_salary_components IS 'Calculates salary components based on Excel formula: Basic=50%, HRA=40% of Basic, Other=Balance';
COMMENT ON FUNCTION calculate_statutory_deductions IS 'Calculates EPF (12% of Basic) and ESIC (0.75% of Gross) deductions';
COMMENT ON VIEW payroll_register_view IS 'Excel-format view of payroll register for easy display and export';

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_register_month_employee ON payroll_register(payroll_month, user_id);
CREATE INDEX IF NOT EXISTS idx_variable_earnings_month_user ON variable_earnings(payroll_month, user_id);
CREATE INDEX IF NOT EXISTS idx_manual_deductions_month_user ON manual_deductions(payroll_month, user_id);
