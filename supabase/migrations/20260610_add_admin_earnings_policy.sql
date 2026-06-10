-- Add RLS policy for admins to view all earnings
-- This allows admins to see all task_earnings records for analytics

-- Check if policy already exists, drop it if it does
DROP POLICY IF EXISTS "Admins can view all earnings" ON task_earnings;

-- Add new policy for admins to view all earnings
CREATE POLICY "Admins can view all earnings"
  ON task_earnings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Keep existing policy for regular users to view own earnings
CREATE POLICY "Users can view own earnings"
  ON task_earnings
  FOR SELECT
  USING (auth.uid() = user_id);
