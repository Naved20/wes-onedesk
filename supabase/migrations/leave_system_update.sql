-- Leave System Migration: New Leave Policy
-- Run this in Supabase SQL Editor

-- Step 1: Update leave_type enum — add new types
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'medical';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'lop';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'half_day';

-- Step 2: Add new columns to leave_balances table
ALTER TABLE leave_balances 
  ADD COLUMN IF NOT EXISTS medical_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lop_leaves_used NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_day_leaves_used NUMERIC DEFAULT 0;

-- Step 3: Update casual_leaves_entitled default to 6 (was 2)
ALTER TABLE leave_balances 
  ALTER COLUMN casual_leaves_entitled SET DEFAULT 6;

-- Step 4: Migrate old data — convert 'sick' to 'medical', 'unplanned' to 'lop'
UPDATE leaves SET leave_type = 'medical' WHERE leave_type = 'sick';
UPDATE leaves SET leave_type = 'lop' WHERE leave_type = 'unplanned';

-- Step 5: Migrate old balance data
UPDATE leave_balances SET medical_leaves_used = sick_leaves_used WHERE sick_leaves_used > 0;
UPDATE leave_balances SET lop_leaves_used = unplanned_leaves_used WHERE unplanned_leaves_used > 0;
