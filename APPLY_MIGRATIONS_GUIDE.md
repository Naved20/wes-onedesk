# WES OneDesk - Apply Pending Migrations Guide

## ⚠️ CRITICAL: You must apply these migrations manually in Supabase SQL Editor

Since you're using Lovable, you need to run these SQL scripts directly in your Supabase dashboard.

---

## 🔧 How to Access Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your WES OneDesk project
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New Query"** button

---

## 📋 STEP 1: Add 2026 Holidays

**File**: `supabase/migrations/20260530000001_add_2026_holidays.sql`

Copy and paste this SQL into the SQL Editor and click **"Run"**:

```sql
-- Add 2026 Indian National Holidays
INSERT INTO public.holidays (name, date, is_national, description) VALUES
('Republic Day', '2026-01-26', true, 'National holiday celebrating the adoption of the Constitution'),
('Maha Shivaratri', '2026-02-13', true, 'Hindu festival'),
('Holi', '2026-03-29', true, 'Festival of colors'),
('Good Friday', '2026-04-10', true, 'Christian holiday'),
('Eid ul-Fitr', '2026-04-10', true, 'Islamic festival marking end of Ramadan'),
('Buddha Purnima', '2026-05-03', true, 'Buddhist festival'),
('Eid ul-Adha', '2026-05-28', true, 'Islamic festival of sacrifice'),
('Independence Day', '2026-08-15', true, 'National holiday celebrating independence'),
('Janmashtami', '2026-09-07', true, 'Hindu festival celebrating birth of Krishna'),
('Milad un-Nabi', '2026-09-24', true, 'Islamic holiday celebrating Prophet Muhammad birthday'),
('Mahatma Gandhi Jayanti', '2026-10-02', true, 'National holiday celebrating Gandhi birthday'),
('Dussehra', '2026-10-12', true, 'Hindu festival'),
('Diwali', '2026-11-08', true, 'Festival of lights'),
('Guru Nanak Jayanti', '2026-11-24', true, 'Sikh festival'),
('Christmas', '2026-12-25', true, 'Christian holiday')
ON CONFLICT (date) DO NOTHING;
```

**Verify**: Run this to check holidays were added:
```sql
SELECT * FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026 ORDER BY date;
```

You should see 15 holidays for 2026.

---

## 📋 STEP 2: Create Email Sync Function

**File**: `supabase/migrations/20260530000003_create_update_user_email_function.sql`

Copy and paste this SQL into the SQL Editor and click **"Run"**:

```sql
-- Create function to update user email in both auth.users and employee_profiles
-- This ensures email stays in sync across both tables

CREATE OR REPLACE FUNCTION public.update_user_email_and_profile(
  p_user_id UUID,
  p_new_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_old_email TEXT;
BEGIN
  -- Get old email
  SELECT email INTO v_old_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_old_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Validate new email
  IF p_new_email IS NULL OR p_new_email = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'New email cannot be empty'
    );
  END IF;
  
  -- Check if new email already exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_new_email AND id != p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email already exists'
    );
  END IF;
  
  -- Update auth.users email
  UPDATE auth.users
  SET 
    email = p_new_email,
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      to_jsonb(p_new_email)
    ),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Update employee_profiles email
  UPDATE employee_profiles
  SET 
    email = p_new_email,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'old_email', v_old_email,
    'new_email', p_new_email,
    'message', 'Email updated successfully in both auth and profile'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.update_user_email_and_profile(UUID, TEXT) IS 
'Updates user email in both auth.users and employee_profiles tables to keep them in sync';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_email_and_profile(UUID, TEXT) TO authenticated;
```

**Verify**: Run this to check function was created:
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'update_user_email_and_profile';
```

---

## 📋 STEP 3: Fix Existing Email Mismatches

**IMPORTANT**: This will sync all existing email mismatches between auth.users and employee_profiles.

Copy and paste this SQL into the SQL Editor and click **"Run"**:

```sql
-- Find and display all email mismatches
SELECT 
  ep.user_id,
  au.email AS auth_email,
  ep.email AS profile_email,
  ep.first_name,
  ep.last_name
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;

-- Fix all mismatches by updating auth.users to match employee_profiles
-- (Profile email is considered the source of truth)
UPDATE auth.users au
SET 
  email = ep.email,
  raw_user_meta_data = jsonb_set(
    COALESCE(au.raw_user_meta_data, '{}'::jsonb),
    '{email}',
    to_jsonb(ep.email)
  ),
  updated_at = NOW()
FROM employee_profiles ep
WHERE au.id = ep.user_id 
  AND au.email != ep.email;

-- Show results
SELECT 
  ep.user_id,
  au.email AS auth_email,
  ep.email AS profile_email,
  ep.first_name,
  ep.last_name
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;
```

**Expected Result**: The final SELECT should return 0 rows (no mismatches).

---

## 📋 STEP 4: Exclude Holidays from Absent Count

**File**: `supabase/migrations/20260530000002_exclude_holidays_from_absent_count.sql`

Copy and paste this SQL into the SQL Editor and click **"Run"**:

```sql
-- Exclude holidays from absent count
-- When a date is a holiday, it should not be counted as absent

CREATE OR REPLACE FUNCTION public.calculate_attendance_stats(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_working_days INTEGER;
  v_present_days NUMERIC;
  v_half_days NUMERIC;
  v_late_days INTEGER;
  v_pending_days INTEGER;
  v_rejected_days INTEGER;
  v_casual_leaves NUMERIC;
  v_sick_leaves NUMERIC;
  v_unplanned_leaves NUMERIC;
  v_absent_days NUMERIC;
  v_percentage NUMERIC;
  v_effective_present NUMERIC;
  v_present_on_time INTEGER;
BEGIN
  -- Calculate total working days for the month
  v_working_days := calculate_monthly_working_days(p_year, p_month);
  
  -- Count approved full-day attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = false;
  
  -- Count approved half-day attendance (each counts as 0.5)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_half_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = true;
  
  -- Count late check-ins
  SELECT COALESCE(COUNT(*), 0)
  INTO v_late_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND is_late = true;
  
  -- Count present on time (not late)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_on_time
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_late = false
    AND is_half_day = false;
  
  -- Count pending attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_pending_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'pending';
  
  -- Count rejected attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_rejected_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'rejected';
  
  -- Count approved casual leaves (100% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_casual_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type IN ('casual', 'emergency');
  
  -- Count approved sick leaves (50% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_sick_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type = 'sick';
  
  -- Count unplanned leaves (0% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_unplanned_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type = 'unplanned';
  
  -- Calculate effective present days
  -- Present (full) + Half days (0.5 each) + Casual leaves (100%) + Sick leaves (50%)
  v_effective_present := v_present_days + (v_half_days * 0.5) + v_casual_leaves + (v_sick_leaves * 0.5);
  
  -- FIXED: Count actual absent records from database, excluding holidays
  -- Exclude dates that are holidays from absent count
  SELECT COALESCE(
    SUM(CASE WHEN a.is_half_day THEN 0.5 ELSE 1 END), 
    0
  )
  INTO v_absent_days
  FROM attendance a
  WHERE a.user_id = p_user_id
    AND EXTRACT(YEAR FROM a.date) = p_year
    AND EXTRACT(MONTH FROM a.date) = p_month
    AND (a.calculated_status = 'absent' OR a.status = 'rejected')
    AND a.date <= CURRENT_DATE  -- Only count past and today's absents
    AND NOT EXISTS (
      -- Exclude dates that are holidays
      SELECT 1 FROM holidays h
      WHERE h.date = a.date
    )
    AND EXTRACT(DOW FROM a.date) != 0;  -- Also exclude Sundays (day of week 0)
  
  -- Calculate attendance percentage
  IF v_working_days > 0 THEN
    v_percentage := (v_effective_present / v_working_days) * 100;
  ELSE
    v_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'working_days', v_working_days,
    'present_days', v_present_days,
    'half_days', v_half_days,
    'late_days', v_late_days,
    'pending_days', v_pending_days,
    'rejected_days', v_rejected_days,
    'casual_leaves', v_casual_leaves,
    'sick_leaves', v_sick_leaves,
    'unplanned_leaves', v_unplanned_leaves,
    'absent_days', v_absent_days,
    'effective_present', ROUND(v_effective_present, 1),
    'attendance_percentage', ROUND(LEAST(v_percentage, 100), 1),
    'present_on_time', v_present_on_time
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_attendance_stats(UUID, INTEGER, INTEGER) IS 
'Calculates attendance statistics for a user in a specific month. Excludes holidays and Sundays from absent count.';
```

**Verify**: Run this to test the function:
```sql
-- Test with a sample user (replace with actual user_id)
SELECT calculate_attendance_stats(
  (SELECT user_id FROM employee_profiles LIMIT 1),
  2026,
  5
);
```

---

## 📋 STEP 5: Deploy/Redeploy Password Update Edge Function

The password update edge function exists but may need redeployment. 

### Option A: Redeploy via Supabase Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. Find `update-user-password` function
3. Click **"Deploy"** or **"Redeploy"**

### Option B: Manual Password Reset (Immediate Fix)

If the edge function deployment is not working, use this SQL to manually reset a user's password:

```sql
-- Replace 'USER_ID_HERE' with actual user_id and 'NEW_PASSWORD' with desired password
-- This bypasses the edge function and directly updates auth.users

-- Example for the user with email mismatch issue:
-- First, find the user_id
SELECT id, email FROM auth.users WHERE email = 'soyebsheikh@gmail.com';

-- Then update password (replace USER_ID and PASSWORD)
-- Note: Supabase will automatically hash the password
UPDATE auth.users
SET 
  encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf')),
  updated_at = NOW()
WHERE id = 'USER_ID_HERE';
```

---

## ✅ Verification Checklist

After running all migrations, verify:

- [ ] **Holidays**: `SELECT COUNT(*) FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026;` returns 15
- [ ] **Email Sync Function**: Function exists and can be called from frontend
- [ ] **Email Mismatches Fixed**: No rows returned from mismatch query
- [ ] **Attendance Stats**: Holidays excluded from absent count
- [ ] **Password Update**: Test changing a user's password and logging in with new password

---

## 🆘 Troubleshooting

### Issue: "permission denied for schema auth"
**Solution**: Make sure you're running queries as the database owner or with proper permissions. In Supabase SQL Editor, you should have these permissions by default.

### Issue: Email sync not working from frontend
**Solution**: 
1. Verify function was created: `SELECT * FROM pg_proc WHERE proname = 'update_user_email_and_profile';`
2. Check RLS policies on employee_profiles table
3. Verify GRANT statement was executed

### Issue: Password update still failing
**Solution**: Use the manual password reset SQL from Step 5, Option B

---

## 📞 Need Help?

If you encounter any errors while running these migrations, copy the error message and let me know. I'll help you troubleshoot.

---

**Created**: May 30, 2026
**Status**: Pending Application
