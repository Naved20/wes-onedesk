-- Add DELETE policies for support_requests
-- This allows admin and manager to delete support requests

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

COMMENT ON POLICY "Admins can delete all requests" ON support_requests 
IS 'Allows admins to delete any support request and its replies';

COMMENT ON POLICY "Managers can delete all requests" ON support_requests 
IS 'Allows managers to delete any support request and its replies';
