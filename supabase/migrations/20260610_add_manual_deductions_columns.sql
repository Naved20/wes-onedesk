-- Add columns for manual deductions to salaries table
-- This allows storing custom deductions with details and totals

-- Add manual_deductions_details column (JSONB for storing custom deductions)
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS manual_deductions_details JSONB DEFAULT '{}'::jsonb;

-- Add manual_deductions_total column (numeric for pre-calculated sum)
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS manual_deductions_total NUMERIC(12, 2) DEFAULT 0;

-- Create index for better query performance on manual_deductions_details
CREATE INDEX IF NOT EXISTS idx_salaries_manual_deductions_details ON salaries USING GIN(manual_deductions_details);

-- Add comment to explain the columns
COMMENT ON COLUMN salaries.manual_deductions_details IS 'JSONB field storing custom deductions as key-value pairs (e.g., {"Loan EMI": 5000, "Insurance": 2000})';
COMMENT ON COLUMN salaries.manual_deductions_total IS 'Pre-calculated total of all custom deductions for quick access';
