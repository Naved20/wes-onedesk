-- =====================================================
-- ADD COMPLETE SALARY STRUCTURE COLUMNS TO SALARIES TABLE
-- =====================================================

-- Add columns for complete salary breakdown
ALTER TABLE public.salaries 
ADD COLUMN IF NOT EXISTS basic_earned NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hra_earned NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_allowance_earned NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS variable_earnings_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS variable_earnings_total NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS epf_employee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS esic_employee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_deduction NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS professional_tax NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_salary_calculated NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_salary_manual NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS epf_employer NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS esic_employer NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_employer_contribution NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ctc NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manager_proposed_salary NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS manager_proposed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS manager_proposed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manager_justification TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Add comments for clarity
COMMENT ON COLUMN salaries.basic_earned IS 'Basic salary earned based on attendance (Basic % of gross earned)';
COMMENT ON COLUMN salaries.hra_earned IS 'HRA earned (HRA % of basic earned)';
COMMENT ON COLUMN salaries.other_allowance_earned IS 'Other allowance earned (Other % of gross earned)';
COMMENT ON COLUMN salaries.variable_earnings_details IS 'JSON object with variable earning types and amounts';
COMMENT ON COLUMN salaries.variable_earnings_total IS 'Sum of all variable earnings';
COMMENT ON COLUMN salaries.epf_employee IS 'Employee EPF deduction (12% of basic)';
COMMENT ON COLUMN salaries.esic_employee IS 'Employee ESIC deduction (0.75% of gross)';
COMMENT ON COLUMN salaries.total_deductions IS 'Sum of all employee deductions';
COMMENT ON COLUMN salaries.gross_salary IS 'Total gross earnings (fixed + variable)';
COMMENT ON COLUMN salaries.net_salary_calculated IS 'Calculated net salary (gross - deductions)';
COMMENT ON COLUMN salaries.net_salary_manual IS 'Manual override of net salary';
COMMENT ON COLUMN salaries.epf_employer IS 'Employer EPF contribution (12% of basic)';
COMMENT ON COLUMN salaries.esic_employer IS 'Employer ESIC contribution (3.25% of gross)';
COMMENT ON COLUMN salaries.total_employer_contribution IS 'Total employer contributions';
COMMENT ON COLUMN salaries.total_ctc IS 'Total Cost to Company (gross + employer contributions)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_salaries_approval_status ON salaries(approval_status);
CREATE INDEX IF NOT EXISTS idx_salaries_user_month_year ON salaries(user_id, month, year);

-- Update existing records to have default values
UPDATE salaries 
SET 
  basic_earned = COALESCE(basic_earned, 0),
  hra_earned = COALESCE(hra_earned, 0),
  other_allowance_earned = COALESCE(other_allowance_earned, 0),
  variable_earnings_details = COALESCE(variable_earnings_details, '{}'::jsonb),
  variable_earnings_total = COALESCE(variable_earnings_total, 0),
  epf_employee = COALESCE(epf_employee, 0),
  esic_employee = COALESCE(esic_employee, 0),
  total_deductions = COALESCE(total_deductions, 0),
  gross_salary = COALESCE(gross_salary, base_salary),
  net_salary_calculated = COALESCE(net_salary_calculated, final_salary),
  epf_employer = COALESCE(epf_employer, 0),
  esic_employer = COALESCE(esic_employer, 0),
  total_employer_contribution = COALESCE(total_employer_contribution, 0),
  total_ctc = COALESCE(total_ctc, base_salary),
  approval_status = COALESCE(approval_status, 'draft')
WHERE basic_earned IS NULL 
   OR hra_earned IS NULL 
   OR approval_status IS NULL;
