-- FIX: Add DELETE policies for support_requests
-- Run this in Supabase SQL Editor to enable delete functionality

-- Drop existing delete policies if any
DROP POLICY IF EXISTS "Admins can delete all requests" ON support_requests;
DROP POLICY IF EXISTS "Managers can delete all requests" ON support_requests;

-- Admins can delete all requests
CREATE POLICY "Admins can delete all requests"
  ON support_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Managers can delete all requests  
CREATE POLICY "Managers can delete all requests"
  ON support_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
  );

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'support_requests' 
AND cmd = 'DELETE';

-- You should see 2 rows:
-- 1. Admins can delete all requests
-- 2. Managers can delete all requests
