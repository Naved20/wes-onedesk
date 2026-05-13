# How to Run the Assignment Groups Migration

## Step-by-Step Instructions

### 1. Open Supabase Dashboard
- Go to your Supabase project: https://supabase.com/dashboard
- Navigate to your project

### 2. Open SQL Editor
- Click on "SQL Editor" in the left sidebar
- Click "New Query" button

### 3. Copy the Migration SQL
- Open the file `ADD_ASSIGNMENT_GROUPS_MIGRATION.sql` in your code editor
- Select all content (Ctrl+A or Cmd+A)
- Copy (Ctrl+C or Cmd+C)

### 4. Paste and Execute
- Paste the SQL into the Supabase SQL Editor
- Click "Run" button (or press Ctrl+Enter / Cmd+Enter)

### 5. Verify Success
You should see a success message. The migration will:
- Drop existing policies (if any)
- Create/update assignment_groups table
- Create/update assignment_group_members table
- Create/update task_assignment_groups table
- Set up proper RLS policies without recursion
- Create helper functions

### 6. Test Assignment Groups
1. Go to your app
2. Navigate to "Assignment Groups" page
3. Try creating a new group
4. Select members
5. Save

**Expected Result**: Group should be created successfully without 500 errors

### 7. Check Browser Console
- Open browser console (F12)
- Look for any errors
- If you see errors, share them for further diagnosis

---

## What This Migration Does

### Tables Created/Updated:
1. **assignment_groups** - Stores group information
2. **assignment_group_members** - Stores group membership
3. **task_assignment_groups** - Links groups to tasks

### RLS Policies Fixed:
- ✅ Removed infinite recursion in SELECT policies
- ✅ Admins can manage all groups
- ✅ Managers can view all groups
- ✅ Employees can view active groups
- ✅ All authenticated users can view group members

### Functions Created:
1. **get_assignment_group_members(group_id)** - Get members with details
2. **get_user_assignment_groups(user_id)** - Get groups for a user

---

## Troubleshooting

### If you get "relation already exists" errors:
This is normal - the migration uses `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` to handle existing objects.

### If you still get 500 errors after migration:
1. Check browser console for specific error messages
2. Verify the migration ran successfully (check for green success message)
3. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)
4. Check Supabase logs in Dashboard → Logs

### If groups still don't appear:
1. Check if you're logged in as admin
2. Verify user_roles table has your user with 'admin' role
3. Check browser console for fetch errors

---

## Need Help?

If you encounter any issues:
1. Share the exact error message from browser console
2. Share any error from Supabase SQL Editor
3. Share screenshots if helpful
