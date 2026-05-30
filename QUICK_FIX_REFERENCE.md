# Quick Fix Reference - WES OneDesk

## 🚀 How to Access Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your **WES OneDesk** project
3. Click **"SQL Editor"** (left sidebar)
4. Click **"New Query"**
5. Paste SQL and click **"Run"**

---

## 🔥 MOST URGENT: Fix Email Login Issue

**Problem**: User can't login with new email (only old email works)

**Solution**: Run this SQL in Supabase SQL Editor:

```sql
-- Fix all email mismatches
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
```

**Verify it worked**:
```sql
-- Should return 0 rows
SELECT au.email AS auth_email, ep.email AS profile_email
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;
```

---

## 🎉 Add 2026 Holidays

**Problem**: Holidays not showing in calendar

**Solution**: Run this SQL:

```sql
INSERT INTO public.holidays (name, date, is_national, description) VALUES
('Republic Day', '2026-01-26', true, 'National holiday'),
('Maha Shivaratri', '2026-02-13', true, 'Hindu festival'),
('Holi', '2026-03-29', true, 'Festival of colors'),
('Good Friday', '2026-04-10', true, 'Christian holiday'),
('Eid ul-Fitr', '2026-04-10', true, 'Islamic festival'),
('Buddha Purnima', '2026-05-03', true, 'Buddhist festival'),
('Eid ul-Adha', '2026-05-28', true, 'Islamic festival'),
('Independence Day', '2026-08-15', true, 'National holiday'),
('Janmashtami', '2026-09-07', true, 'Hindu festival'),
('Milad un-Nabi', '2026-09-24', true, 'Islamic holiday'),
('Mahatma Gandhi Jayanti', '2026-10-02', true, 'National holiday'),
('Dussehra', '2026-10-12', true, 'Hindu festival'),
('Diwali', '2026-11-08', true, 'Festival of lights'),
('Guru Nanak Jayanti', '2026-11-24', true, 'Sikh festival'),
('Christmas', '2026-12-25', true, 'Christian holiday')
ON CONFLICT (date) DO NOTHING;
```

**Verify**:
```sql
SELECT * FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026 ORDER BY date;
-- Should show 15 holidays
```

---

## 🔐 Reset User Password Manually

**Problem**: Password change not working

**Solution**: Run this SQL (replace USER_EMAIL and NEW_PASSWORD):

```sql
-- Step 1: Find user ID
SELECT id, email FROM auth.users WHERE email = 'USER_EMAIL_HERE';

-- Step 2: Reset password (use the ID from step 1)
UPDATE auth.users
SET 
  encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf')),
  updated_at = NOW()
WHERE id = 'USER_ID_FROM_STEP_1';
```

**Example**:
```sql
-- Find user
SELECT id, email FROM auth.users WHERE email = 'atrayabdul.wes1@gmail.com';

-- Reset password to "Welcome123"
UPDATE auth.users
SET 
  encrypted_password = crypt('Welcome123', gen_salt('bf')),
  updated_at = NOW()
WHERE id = 'abc-123-def-456';  -- Replace with actual ID
```

---

## 📊 Check System Status

Run these to verify everything is working:

```sql
-- 1. Count 2026 holidays (should be 15)
SELECT COUNT(*) FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026;

-- 2. Check email mismatches (should be 0)
SELECT COUNT(*) FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;

-- 3. List all users with their emails
SELECT 
  ep.first_name,
  ep.last_name,
  au.email AS login_email,
  ep.email AS profile_email,
  CASE WHEN au.email = ep.email THEN '✓ Synced' ELSE '✗ Mismatch' END AS status
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
ORDER BY ep.first_name;
```

---

## 🎯 Complete Setup (Run All 3 Migrations)

If you want to apply all pending migrations at once, run these in order:

### 1. Add Holidays
```sql
-- Copy from: supabase/migrations/20260530000001_add_2026_holidays.sql
-- (See full SQL in APPLY_MIGRATIONS_GUIDE.md)
```

### 2. Create Email Sync Function
```sql
-- Copy from: supabase/migrations/20260530000003_create_update_user_email_function.sql
-- (See full SQL in APPLY_MIGRATIONS_GUIDE.md)
```

### 3. Update Attendance Stats Function
```sql
-- Copy from: supabase/migrations/20260530000002_exclude_holidays_from_absent_count.sql
-- (See full SQL in APPLY_MIGRATIONS_GUIDE.md)
```

---

## 📁 Where to Find Full SQL

All complete SQL scripts are in these files:
- `APPLY_MIGRATIONS_GUIDE.md` - Complete guide with all migrations
- `FIX_EMAIL_MISMATCH.sql` - Email sync fix
- `MANUAL_PASSWORD_RESET.sql` - Password reset
- `supabase/migrations/` folder - All migration files

---

## ✅ After Running Everything

Your system should have:
- ✅ 15 holidays for 2026
- ✅ All emails synced (auth = profile)
- ✅ Email changes update both tables automatically
- ✅ Holidays excluded from absent count
- ✅ Users can login with current email
- ✅ Password changes work (or use manual reset)

---

## 🆘 Common Issues

### "permission denied for schema auth"
**Fix**: You're already in SQL Editor with proper permissions, this shouldn't happen. If it does, contact Supabase support.

### "function already exists"
**Fix**: This is OK! It means the function was already created. Skip to next step.

### "relation does not exist"
**Fix**: Check table name spelling. Use `\dt` to list all tables.

### Password still not working after manual reset
**Fix**: 
1. Make sure you used the correct user ID
2. Try logging out completely and logging back in
3. Clear browser cache
4. Try in incognito/private window

---

**Need more help?** Check `CURRENT_STATUS_AND_NEXT_STEPS.md` for detailed explanations.
