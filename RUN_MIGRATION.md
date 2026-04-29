# How to Run Support Requests Migration

## Option 1: Using Supabase CLI (Recommended)

```bash
# Push the migration to your database
supabase db push
```

## Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the content from: `supabase/migrations/20260428200000_create_support_requests.sql`
4. Click **Run**

## Option 3: Direct SQL (If above don't work)

Run this SQL in Supabase SQL Editor:

```sql
-- Create support_requests table
CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_assigned_to ON support_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON support_requests(created_at DESC);

-- Enable RLS
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own requests" ON support_requests;
DROP POLICY IF EXISTS "Users can create requests" ON support_requests;
DROP POLICY IF EXISTS "Users can update their own pending requests" ON support_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON support_requests;
DROP POLICY IF EXISTS "Managers can view all requests" ON support_requests;
DROP POLICY IF EXISTS "Admins can update all requests" ON support_requests;
DROP POLICY IF EXISTS "Managers can update all requests" ON support_requests;

-- Create policies
CREATE POLICY "Users can view their own requests"
  ON support_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create requests"
  ON support_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests"
  ON support_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all requests"
  ON support_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Managers can view all requests"
  ON support_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
  );

CREATE POLICY "Admins can update all requests"
  ON support_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Managers can update all requests"
  ON support_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
  );

-- Grant permissions
GRANT ALL ON support_requests TO authenticated;
```

## After Running Migration

1. **Refresh your browser** (Ctrl + Shift + R for hard refresh)
2. Go to Settings → Support & Requests
3. Try creating a new request

## Verify Migration

Check if table was created:

```sql
SELECT * FROM support_requests LIMIT 1;
```

If you see no errors, the migration was successful! ✅
