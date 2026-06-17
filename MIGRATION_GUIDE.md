# Database Migration Guide - Weekly Reports

## Problem
The Weekly Reports feature requires the `weekly_reports` table to be created in the Supabase database. The migration file exists at:
- `supabase/migrations/20250617_create_weekly_reports_table.sql`

However, it hasn't been applied to the database yet, causing "page not found" errors when users try to access the Weekly Reports page.

## Solution

Choose ONE of the following methods to apply the migration:

### Method 1: Using Supabase Web Dashboard (Easiest) ✅ RECOMMENDED

1. Go to your Supabase project: https://app.supabase.com/
2. Select your project: `glijytescdhdtihzlhlg`
3. In the left sidebar, click **SQL Editor**
4. Click the **New Query** button
5. Copy and paste the entire SQL from `supabase/migrations/20250617_create_weekly_reports_table.sql`
6. Click **Run** (or press Ctrl+Enter)
7. You should see a success message

### Method 2: Using Supabase CLI (If Installed)

```bash
# From project root directory
supabase db push
```

### Method 3: Using curl/API (Advanced)

```bash
curl -X POST https://glijytescdhdtihzlhlg.supabase.co/rest/v1/exec_sql \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "paste SQL here"}'
```

## SQL to Execute

The SQL creates:
- **weekly_reports table** with columns:
  - id (UUID primary key)
  - employee_id, employee_name
  - week_starting, week_ending (dates)
  - objectives, tasks_completed, hours_spent
  - status (completed/in_progress/blocked)
  - approval_status (pending/approved/rejected)
  - timestamps and manager notes

- **Indexes** for performance on:
  - employee_id
  - manager_id
  - week_starting
  - approval_status

- **Row Level Security (RLS)** policies:
  - Employees can only see their own reports
  - Managers/Admins can see all reports
  - Employees can create their own reports
  - Employees can edit pending reports
  - Managers can approve/reject reports

## After Migration

Once applied, test the feature:

1. Navigate to `/weekly-reports` in the app
2. You should see the Weekly Reports page load
3. Employees can click "New Report" to create a report
4. The form should save data to the database
5. Managers/Admins can see all reports in a dashboard

## Troubleshooting

If you get an error:

- **"Table already exists"**: The table may have already been created. Check if `weekly_reports` exists in your Supabase database.
- **"Permission denied"**: Make sure you're using a role with admin permissions in Supabase SQL Editor.
- **"RLS policy error"**: Check that the `user_roles` table exists. If not, weekly reports should still work but without role-based filtering initially.

## Checking if Migration Was Successful

In Supabase SQL Editor, run:
```sql
SELECT * FROM public.weekly_reports LIMIT 1;
```

If the table exists, you'll see the column headers. If not, you'll see an error.

---

**Status**: ⏳ Pending database migration application
**Feature**: Weekly Reports for employee performance tracking
**Next Step**: Apply the SQL migration using Method 1 above
