-- Create support_request_replies table for chat-like conversation
CREATE TABLE IF NOT EXISTS support_request_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_replies_request_id ON support_request_replies(request_id);
CREATE INDEX IF NOT EXISTS idx_support_replies_user_id ON support_request_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_support_replies_created_at ON support_request_replies(created_at);

-- Enable RLS
ALTER TABLE support_request_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view replies on their requests" ON support_request_replies;
DROP POLICY IF EXISTS "Users can create replies on their requests" ON support_request_replies;
DROP POLICY IF EXISTS "Admins can view all replies" ON support_request_replies;
DROP POLICY IF EXISTS "Managers can view all replies" ON support_request_replies;
DROP POLICY IF EXISTS "Admins can create replies" ON support_request_replies;
DROP POLICY IF EXISTS "Managers can create replies" ON support_request_replies;

-- Policies for support_request_replies
-- Users can view replies on their own requests (non-internal only)
CREATE POLICY "Users can view replies on their requests"
  ON support_request_replies FOR SELECT
  TO authenticated
  USING (
    is_internal = false AND
    EXISTS (
      SELECT 1 FROM support_requests
      WHERE support_requests.id = support_request_replies.request_id
      AND support_requests.user_id = auth.uid()
    )
  );

-- Users can create replies on their own requests
CREATE POLICY "Users can create replies on their requests"
  ON support_request_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_requests
      WHERE support_requests.id = support_request_replies.request_id
      AND support_requests.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

-- Admins can view all replies (including internal)
CREATE POLICY "Admins can view all replies"
  ON support_request_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Managers can view all replies (including internal)
CREATE POLICY "Managers can view all replies"
  ON support_request_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
  );

-- Admins can create replies
CREATE POLICY "Admins can create replies"
  ON support_request_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    AND auth.uid() = user_id
  );

-- Managers can create replies
CREATE POLICY "Managers can create replies"
  ON support_request_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
    AND auth.uid() = user_id
  );

-- Add updated_at trigger
CREATE TRIGGER update_support_replies_updated_at
  BEFORE UPDATE ON support_request_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON support_request_replies TO authenticated;

COMMENT ON TABLE support_request_replies IS 'Chat-like replies/comments on support requests';
COMMENT ON COLUMN support_request_replies.is_internal IS 'Internal notes visible only to admin/manager';
