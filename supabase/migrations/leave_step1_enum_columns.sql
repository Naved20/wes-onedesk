-- STEP 1: Run this FIRST
-- Add new enum values and new columns

ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'medical';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'lop';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'half_day';

-- Add new columns to leave_balances table
ALTER TABLE leave_balances 
  ADD COLUMN IF NOT EXISTS medical_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_day_leaves_used NUMERIC DEFAULT 0;

-- Update casual_leaves_entitled default to 6 (was 2)
ALTER TABLE leave_balances 
  ALTER COLUMN casual_leaves_entitled SET DEFAULT 6;
