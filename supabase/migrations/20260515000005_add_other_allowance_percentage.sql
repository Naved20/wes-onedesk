-- =====================================================
-- ADD OTHER_ALLOWANCE_PERCENTAGE TO SALARY_STRUCTURES
-- =====================================================

-- Drop the computed other_allowance column
ALTER TABLE salary_structures 
DROP COLUMN IF EXISTS other_allowance CASCADE;

-- Add other_allowance_percentage column
ALTER TABLE salary_structures
ADD COLUMN IF NOT EXISTS other_allowance_percentage DECIMAL(5, 2) DEFAULT 30.00;

-- Recreate other_allowance as a computed column based on percentage
ALTER TABLE salary_structures
ADD COLUMN other_allowance DECIMAL(10, 2) 
GENERATED ALWAYS AS (fixed_gross_salary * other_allowance_percentage / 100) STORED;

-- Add constraint for valid percentage
ALTER TABLE salary_structures
ADD CONSTRAINT valid_other_allowance_percentage 
CHECK (other_allowance_percentage >= 0 AND other_allowance_percentage <= 100);

-- Update comment
COMMENT ON COLUMN salary_structures.other_allowance_percentage IS 'Other allowance as percentage of Gross (typically 30%)';
COMMENT ON COLUMN salary_structures.other_allowance IS 'Computed: Gross × Other Allowance %';

-- Update existing records to have 30% as default
UPDATE salary_structures
SET other_allowance_percentage = 30.00
WHERE other_allowance_percentage IS NULL;
