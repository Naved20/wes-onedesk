-- Migration to add document upload & continuous clarification chat functionality for leaves

-- 1. Add document_url and document_name columns to leaves table
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS document_name TEXT;

-- 2. Create leave_conversations table for chat thread / clarifications
CREATE TABLE IF NOT EXISTS leave_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id UUID NOT NULL REFERENCES leaves(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_leave_conversations_leave_id ON leave_conversations(leave_id);
CREATE INDEX IF NOT EXISTS idx_leave_conversations_sender_id ON leave_conversations(sender_id);
CREATE INDEX IF NOT EXISTS idx_leave_conversations_created_at ON leave_conversations(created_at);

-- Enable RLS
ALTER TABLE leave_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view messages for their own leave" ON leave_conversations;
DROP POLICY IF EXISTS "Admins and Managers can view all leave messages" ON leave_conversations;
DROP POLICY IF EXISTS "Users can insert messages for their own leave" ON leave_conversations;
DROP POLICY IF EXISTS "Admins and Managers can insert leave messages" ON leave_conversations;

-- Select Policy for Employee (own leave)
CREATE POLICY "Users can view messages for their own leave"
  ON leave_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leaves
      WHERE leaves.id = leave_conversations.leave_id
      AND leaves.user_id = auth.uid()
    )
  );

-- Select Policy for Admin/Manager (all leaves)
CREATE POLICY "Admins and Managers can view all leave messages"
  ON leave_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Insert Policy for Employee (own leave)
CREATE POLICY "Users can insert messages for their own leave"
  ON leave_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM leaves
      WHERE leaves.id = leave_conversations.leave_id
      AND leaves.user_id = auth.uid()
    )
  );

-- Insert Policy for Admin/Manager
CREATE POLICY "Admins and Managers can insert leave messages"
  ON leave_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Enable realtime for leave_conversations table if supabase_realtime publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leave_conversations;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leave_conversations_updated_at ON leave_conversations;
CREATE TRIGGER trigger_leave_conversations_updated_at
  BEFORE UPDATE ON leave_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_conversations_updated_at();

-- Grant access to authenticated users
GRANT ALL ON leave_conversations TO authenticated;
