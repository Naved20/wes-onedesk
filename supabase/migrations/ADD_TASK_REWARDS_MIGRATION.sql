-- Add reward system to tasks
-- This migration adds reward_amount to tasks and creates task_earnings table

-- 1. Add reward_amount column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10, 2) DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN tasks.reward_amount IS 'Reward amount in rupees that employees earn when their response is reviewed and approved';

-- 2. Create task_earnings table to track employee earnings
CREATE TABLE IF NOT EXISTS task_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  response_id UUID NOT NULL REFERENCES task_responses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  remark_id UUID REFERENCES task_remarks(id) ON DELETE SET NULL,
  remarked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_earnings_user_id ON task_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_task_earnings_task_id ON task_earnings(task_id);
CREATE INDEX IF NOT EXISTS idx_task_earnings_status ON task_earnings(status);
CREATE INDEX IF NOT EXISTS idx_task_earnings_earned_at ON task_earnings(earned_at);

-- Add RLS policies for task_earnings
ALTER TABLE task_earnings ENABLE ROW LEVEL SECURITY;

-- Employees can view their own earnings
CREATE POLICY "Employees can view own earnings"
  ON task_earnings
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Admins and managers can view all earnings
CREATE POLICY "Admins and managers can view all earnings"
  ON task_earnings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Admins can insert earnings (when approving remarks)
CREATE POLICY "Admins can insert earnings"
  ON task_earnings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admins can update earnings status
CREATE POLICY "Admins can update earnings"
  ON task_earnings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE task_earnings IS 'Tracks earnings from completed and reviewed tasks';
COMMENT ON COLUMN task_earnings.status IS 'pending: awaiting approval, approved: approved but not paid, paid: payment completed';
