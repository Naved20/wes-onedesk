-- Add allocated columns to leave_balances table
-- These columns track the total leave days allocated for each type per month
-- The validation function compares: used + requesting <= allocated

-- Add allocated columns for all leave types (for tracking allocated days per month)
ALTER TABLE leave_balances
  ADD COLUMN IF NOT EXISTS casual_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unplanned_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_leaves_allocated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_day_leaves_allocated INTEGER DEFAULT 0;

-- Ensure sick_leaves_used exists (for consistency with other leave types)
ALTER TABLE leave_balances
  ADD COLUMN IF NOT EXISTS sick_leaves_used NUMERIC DEFAULT 0;

-- Ensure unplanned_leaves_used exists
ALTER TABLE leave_balances
  ADD COLUMN IF NOT EXISTS unplanned_leaves_used NUMERIC DEFAULT 0;

-- Set casual_leaves_allocated to casual_leaves_entitled value for existing records
UPDATE leave_balances
SET casual_leaves_allocated = COALESCE(casual_leaves_entitled, 2)
WHERE casual_leaves_allocated = 0;

-- Add comments for documentation
COMMENT ON COLUMN leave_balances.casual_leaves_allocated IS 'Total casual leave days allocated for this month';
COMMENT ON COLUMN leave_balances.medical_leaves_allocated IS 'Total medical leave days allocated for this month';
COMMENT ON COLUMN leave_balances.emergency_leaves_allocated IS 'Total emergency leave days allocated for this month';
COMMENT ON COLUMN leave_balances.sick_leaves_allocated IS 'Total sick leave days allocated for this month';
COMMENT ON COLUMN leave_balances.unplanned_leaves_allocated IS 'Total unplanned leave days allocated for this month';
COMMENT ON COLUMN leave_balances.lop_leaves_allocated IS 'Total LOP days allocated for this month';
COMMENT ON COLUMN leave_balances.half_day_leaves_allocated IS 'Total half-day leaves allocated for this month';

COMMENT ON COLUMN leave_balances.casual_leaves_used IS 'Casual leave days used this month';
COMMENT ON COLUMN leave_balances.medical_leaves_used IS 'Medical leave days used this month';
COMMENT ON COLUMN leave_balances.emergency_leaves_used IS 'Emergency leave days used this month';
COMMENT ON COLUMN leave_balances.sick_leaves_used IS 'Sick leave days used this month';
COMMENT ON COLUMN leave_balances.unplanned_leaves_used IS 'Unplanned leave days used this month';
COMMENT ON COLUMN leave_balances.lop_leaves_used IS 'LOP days used this month';
COMMENT ON COLUMN leave_balances.half_day_leaves_used IS 'Half-day leaves used this month';
