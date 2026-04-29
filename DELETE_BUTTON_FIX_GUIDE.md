# Fix Delete Button - Support Requests

## Problem
Delete button is not working because DELETE policies are missing in the database.

## Solution
Run the SQL below in **Supabase Dashboard → SQL Editor**

```sql
-- Add DELETE policies for Admin and Manager

DROP POLICY IF EXISTS "Admins can delete all requests" ON support_requests;
DROP POLICY IF EXISTS "Managers can delete all requests" ON support_requests;

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
```

## Steps to Fix:

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste the SQL above**
4. **Click "Run"**
5. **Refresh your browser** (Ctrl + Shift + R)
6. **Test delete button**

## Verify Fix:

Run this query to check if policies are created:

```sql
SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'support_requests' 
AND cmd = 'DELETE';
```

You should see:
- ✅ Admins can delete all requests
- ✅ Managers can delete all requests

## After Fix:

- ✅ Admin can delete any request
- ✅ Manager can delete any request
- ✅ Employee cannot delete (no policy)
- ✅ Replies are automatically deleted (CASCADE)

## Test:

1. Login as Admin/Manager
2. Go to Settings → Support & Requests
3. Click trash icon on any request
4. Confirm deletion
5. Request should be deleted ✅

Done! 🎉
