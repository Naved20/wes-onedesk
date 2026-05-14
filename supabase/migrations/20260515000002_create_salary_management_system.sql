-- =====================================================
-- SALARY MANAGEMENT SYSTEM - COMPLETE SCHEMA
-- =====================================================

-- 1. SALARY STRUCTURES TABLE
-- Stores employee's fixed salary structure
CREATE TABLE IF NOT EXISTS public.salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Fixed Salary Components
    fixed_gross_salary DECIMAL(10, 2) NOT NULL,
    basic_percentage DECIMAL(5, 2) DEFAULT 50.00,
    hra_percentage DECIMAL(5, 2) DEFAULT 40.00,
    
    -- Calculated Components (stored for reference)
    basic_salary DECIMAL(10, 2) GENERATED ALWAYS AS (fixed_gross_salary * basic_percentage / 100) STORED,
    hra_amount DECIMAL(10, 2) GENERATED ALWAYS AS ((fixed_gross_salary * basic_percentage / 100) * hra_percentage / 100) STORED,
    other_allowance DECIMAL(10, 2) GENERATED ALWAYS AS (
        fixed_gross_salary - 
        (fixed_gross_salary * basic_percentage / 100) - 
        ((fixed_gross_salary * basic_percentage / 100) * hra_percentage / 100)
    ) STORED,
    
    -- Statutory Benefits
    epf_applicable BOOLEAN DEFAULT true,
    esic_applicable BOOLEAN DEFAULT true,
    epf_employee_rate DECIMAL(5, 2) DEFAULT 12.00,
    epf_employer_rate DECIMAL(5, 2) DEFAULT 12.00,
    esic_employee_rate DECIMAL(5, 2) DEFAULT 0.75,
    esic_employer_rate DECIMAL(5, 2) DEFAULT 3.25,
    
    -- Bank Details
    bank_account_number TEXT,
    bank_name TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    
    -- PF & ESIC Details
    pf_uan_number TEXT,
    esic_ip_number TEXT,
    
    -- Validity
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT unique_active_salary_per_user UNIQUE (user_id, is_active),
    CONSTRAINT valid_percentages CHECK (basic_percentage > 0 AND basic_percentage <= 100),
    CONSTRAINT valid_hra CHECK (hra_percentage >= 0 AND hra_percentage <= 100),
    CONSTRAINT valid_salary CHECK (fixed_gross_salary > 0)
);

-- 2. EARNING TYPES TABLE
-- Master table for different types of earnings/incentives
CREATE TABLE IF NOT EXISTS public.earning_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earning_code TEXT UNIQUE NOT NULL,
    earning_name TEXT NOT NULL,
    description TEXT,
    is_taxable BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. VARIABLE EARNINGS TABLE
-- Stores month-wise variable earnings/incentives for employees
CREATE TABLE IF NOT EXISTS public.variable_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    earning_type_id UUID NOT NULL REFERENCES earning_types(id),
    
    -- Period
    payroll_month DATE NOT NULL, -- First day of month (e.g., 2024-07-01)
    
    -- Amount
    amount DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1.00,
    rate DECIMAL(10, 2),
    
    -- Details
    remarks TEXT,
    reference_id TEXT, -- Link to task/project if applicable
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_earning_amount CHECK (amount >= 0)
);

-- 4. DEDUCTION TYPES TABLE
-- Master table for different types of deductions
CREATE TABLE IF NOT EXISTS public.deduction_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_code TEXT UNIQUE NOT NULL,
    deduction_name TEXT NOT NULL,
    description TEXT,
    is_statutory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. MANUAL DEDUCTIONS TABLE
-- Stores manual deductions (loans, advances, etc.)
CREATE TABLE IF NOT EXISTS public.manual_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deduction_type_id UUID NOT NULL REFERENCES deduction_types(id),
    
    -- Period
    payroll_month DATE NOT NULL,
    
    -- Amount
    amount DECIMAL(10, 2) NOT NULL,
    
    -- Details
    remarks TEXT,
    reference_id TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_deduction_amount CHECK (amount >= 0)
);

-- 6. PAYROLL REGISTER TABLE
-- Final processed payroll for each employee per month
CREATE TABLE IF NOT EXISTS public.payroll_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_number TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Period
    payroll_month DATE NOT NULL,
    payroll_days INTEGER NOT NULL,
    paid_days DECIMAL(5, 2) NOT NULL,
    
    -- Attendance Summary (from attendance table)
    present_days DECIMAL(5, 2) DEFAULT 0,
    half_days DECIMAL(5, 2) DEFAULT 0,
    paid_leaves DECIMAL(5, 2) DEFAULT 0,
    unpaid_leaves DECIMAL(5, 2) DEFAULT 0,
    absents DECIMAL(5, 2) DEFAULT 0,
    holidays DECIMAL(5, 2) DEFAULT 0,
    lates INTEGER DEFAULT 0,
    
    -- Fixed Salary Components (Earned)
    basic_earned DECIMAL(10, 2) NOT NULL,
    hra_earned DECIMAL(10, 2) NOT NULL,
    other_allowance_earned DECIMAL(10, 2) NOT NULL,
    fixed_gross_earned DECIMAL(10, 2) NOT NULL,
    
    -- Variable Earnings
    variable_earnings_total DECIMAL(10, 2) DEFAULT 0,
    variable_earnings_details JSONB, -- Array of {type, amount, remarks}
    
    -- Total Earnings
    total_gross_earnings DECIMAL(10, 2) NOT NULL,
    
    -- Employee Deductions
    epf_employee DECIMAL(10, 2) DEFAULT 0,
    esic_employee DECIMAL(10, 2) DEFAULT 0,
    manual_deductions_total DECIMAL(10, 2) DEFAULT 0,
    manual_deductions_details JSONB, -- Array of {type, amount, remarks}
    total_deductions DECIMAL(10, 2) NOT NULL,
    
    -- Net Payable
    net_payable DECIMAL(10, 2) NOT NULL,
    
    -- Employer Contributions
    epf_employer DECIMAL(10, 2) DEFAULT 0,
    esic_employer DECIMAL(10, 2) DEFAULT 0,
    total_employer_contribution DECIMAL(10, 2) DEFAULT 0,
    
    -- Total Cost to Company
    total_ctc DECIMAL(10, 2) NOT NULL,
    
    -- Status & Workflow
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid', 'cancelled')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    paid_date DATE,
    payment_mode TEXT, -- bank_transfer, cash, cheque
    payment_reference TEXT,
    
    -- Remarks
    remarks TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT unique_payroll_per_month UNIQUE (user_id, payroll_month),
    CONSTRAINT valid_paid_days CHECK (paid_days >= 0 AND paid_days <= payroll_days)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_salary_structures_user_id ON salary_structures(user_id);
CREATE INDEX idx_salary_structures_active ON salary_structures(user_id, is_active) WHERE is_active = true;

CREATE INDEX idx_variable_earnings_user_month ON variable_earnings(user_id, payroll_month);
CREATE INDEX idx_variable_earnings_type ON variable_earnings(earning_type_id);

CREATE INDEX idx_manual_deductions_user_month ON manual_deductions(user_id, payroll_month);
CREATE INDEX idx_manual_deductions_type ON manual_deductions(deduction_type_id);

CREATE INDEX idx_payroll_register_user_month ON payroll_register(user_id, payroll_month);
CREATE INDEX idx_payroll_register_status ON payroll_register(status);
CREATE INDEX idx_payroll_register_month ON payroll_register(payroll_month);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE earning_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_register ENABLE ROW LEVEL SECURITY;

-- Salary Structures Policies
CREATE POLICY "Admins can manage all salary structures"
ON salary_structures FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Employees can view their own salary structure"
ON salary_structures FOR SELECT
USING (user_id = auth.uid());

-- Earning Types Policies
CREATE POLICY "Everyone can view earning types"
ON earning_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage earning types"
ON earning_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Variable Earnings Policies
CREATE POLICY "Admins can manage all variable earnings"
ON variable_earnings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Employees can view their own earnings"
ON variable_earnings FOR SELECT
USING (user_id = auth.uid());

-- Deduction Types Policies
CREATE POLICY "Everyone can view deduction types"
ON deduction_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage deduction types"
ON deduction_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Manual Deductions Policies
CREATE POLICY "Admins can manage all manual deductions"
ON manual_deductions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Employees can view their own deductions"
ON manual_deductions FOR SELECT
USING (user_id = auth.uid());

-- Payroll Register Policies
CREATE POLICY "Admins can manage all payroll"
ON payroll_register FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Employees can view their own payslips"
ON payroll_register FOR SELECT
USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for salary_structures
CREATE OR REPLACE FUNCTION update_salary_structures_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER salary_structures_updated_at
  BEFORE UPDATE ON salary_structures
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_structures_timestamp();

-- Update timestamp trigger for variable_earnings
CREATE TRIGGER variable_earnings_updated_at
  BEFORE UPDATE ON variable_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_structures_timestamp();

-- Update timestamp trigger for manual_deductions
CREATE TRIGGER manual_deductions_updated_at
  BEFORE UPDATE ON manual_deductions
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_structures_timestamp();

-- Update timestamp trigger for payroll_register
CREATE TRIGGER payroll_register_updated_at
  BEFORE UPDATE ON payroll_register
  FOR EACH ROW
  EXECUTE FUNCTION update_salary_structures_timestamp();

-- =====================================================
-- DEFAULT DATA - EARNING TYPES
-- =====================================================

INSERT INTO earning_types (earning_code, earning_name, description, display_order) VALUES
('LESSON_PLAN', 'Lesson Plan Incentive', 'Incentive for completing lesson plans', 1),
('ENG_TRAINING', 'English Training Task Incentive', 'Incentive for English training tasks', 2),
('DIGITAL_TRAINING', 'Digital Training Task Incentive', 'Incentive for digital training tasks', 3),
('PERFORMANCE_BONUS', 'Performance Bonus', 'Monthly performance bonus', 4),
('ATTENDANCE_BONUS', 'Attendance Bonus', 'Bonus for full attendance', 5),
('OTHER_INCENTIVE', 'Other Incentive', 'Other miscellaneous incentives', 99)
ON CONFLICT (earning_code) DO NOTHING;

-- =====================================================
-- DEFAULT DATA - DEDUCTION TYPES
-- =====================================================

INSERT INTO deduction_types (deduction_code, deduction_name, description, is_statutory, display_order) VALUES
('EPF', 'Employee Provident Fund', 'Statutory EPF deduction', true, 1),
('ESIC', 'Employee State Insurance', 'Statutory ESIC deduction', true, 2),
('LOAN', 'Loan Deduction', 'Loan repayment deduction', false, 3),
('ADVANCE', 'Advance Deduction', 'Salary advance deduction', false, 4),
('OTHER', 'Other Deduction', 'Other miscellaneous deductions', false, 99)
ON CONFLICT (deduction_code) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE salary_structures IS 'Stores employee fixed salary structure with automatic component calculations';
COMMENT ON TABLE earning_types IS 'Master table for different types of variable earnings/incentives';
COMMENT ON TABLE variable_earnings IS 'Month-wise variable earnings for employees';
COMMENT ON TABLE deduction_types IS 'Master table for different types of deductions';
COMMENT ON TABLE manual_deductions IS 'Month-wise manual deductions for employees';
COMMENT ON TABLE payroll_register IS 'Final processed payroll with complete salary breakdown';
