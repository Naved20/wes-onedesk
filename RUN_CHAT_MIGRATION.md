# Support Request Chat System - Migration Guide

## Run This SQL in Supabase Dashboard

Go to **SQL Editor** and run:

```sql
-- Create support_request_replies table
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

-- Policies
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

CREATE POLICY "Admins can view all replies"
  ON support_request_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can create replies"
  ON support_request_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
    AND auth.uid() = user_id
  );

GRANT ALL ON support_request_replies TO authenticated;
```

## Features After Migration:

### ✅ Chat-Style Conversation
- Employee submits request
- Admin/Manager can reply
- Employee can reply back
- Real-time conversation thread

### ✅ UI Features
- WhatsApp-style chat interface
- User avatars with initials
- Timestamp on each message
- Different colors for sender/receiver
- "View Conversation" button on each request
- Enter to send, Shift+Enter for new line

### ✅ Access Control
- Employees see only their own conversations
- Admin/Manager see all conversations
- Internal notes feature (for future use)

## How to Use:

1. **Run the migration above**
2. **Refresh browser** (Ctrl + Shift + R)
3. **Go to Settings → Support & Requests**
4. **Click "View Conversation"** on any request
5. **Type reply and press Enter** to send

Done! 🎉
