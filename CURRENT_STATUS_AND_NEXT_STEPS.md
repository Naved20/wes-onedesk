# WES OneDesk - Current Status & Next Steps

**Date**: May 30, 2026  
**Environment**: Lovable + Supabase

---

## ✅ COMPLETED FIXES (Already Working)

### 1. CTC Calculation Formula ✓
- **Fixed**: CTC now correctly calculated as `Net Payable + Employer Contributions`
- **Files Updated**: 
  - `SalaryManagement.tsx`
  - `PayslipView.tsx`
  - `EmployeeSalaryDetails.tsx`
  - `Salaries.tsx`
- **Status**: Working correctly in all salary views

### 2. Holiday Summary on Attendance Page ✓
- **Added**: Month summary card showing Total Days, Sundays, Holidays, Working Days
- **File**: `Attendance.tsx`
- **Status**: Displaying correctly

### 3. Variable Earnings Renamed ✓
- **Changed**: "Variable Earnings" → "Performance Based Earnings"
- **Files**: All salary components
- **Status**: Updated everywhere

### 4. Holiday Display Priority Fixed ✓
- **Fixed**: Holidays now override everything in calendar
- **Priority Order**: Holiday > Attendance > Leaves > Sunday
- **File**: `Attendance.tsx`
- **Status**: May 16, 17, 18 now show "HO" for everyone

### 5. Sunday Attendance Display ✓
- **Fixed**: Shows "PR" with time if employee checked in on Sunday
- **File**: `Attendance.tsx`
- **Status**: May 10 (Sunday) now shows attendance if present

### 6. Paid Leave Card Added ✓
- **Added**: Paid Leave card to attendance summary
- **File**: `AttendanceStats.tsx`
- **Status**: Displaying correctly

### 7. Attendance Data Fetching ✓
- **Fixed**: Working Days now fetched from database (not hardcoded)
- **File**: `SalaryManagement.tsx`
- **Status**: All attendance variables fetched from database

### 8. Email Sync Logic (Frontend) ✓
- **Added**: Frontend calls `update_user_email_and_profile()` RPC function
- **File**: `Employees.tsx`
- **Status**: Code ready, but needs database function (see pending migrations)

### 9. Password Update Logic (Frontend) ✓
- **Improved**: Better error handling and logging
- **File**: `Employees.tsx`
- **Edge Function**: `update-user-password/index.ts`
- **Status**: Code ready, but edge function may need redeployment

---

## ⚠️ PENDING ACTIONS (Require Manual Steps)

### 🔴 CRITICAL: Apply Database Migrations

You have **3 pending migrations** that must be run in Supabase SQL Editor:

#### Migration 1: Add 2026 Holidays
- **File**: `supabase/migrations/20260530000001_add_2026_holidays.sql`
- **Purpose**: Adds all 2026 Indian holidays including May 16, 17, 18, 28
- **Impact**: Holidays will display correctly in calendar
- **Status**: ❌ NOT APPLIED

#### Migration 2: Email Sync Function
- **File**: `supabase/migrations/20260530000003_create_update_user_email_function.sql`
- **Purpose**: Creates RPC function to sync email between auth.users and employee_profiles
- **Impact**: Email changes will update both tables automatically
- **Status**: ❌ NOT APPLIED

#### Migration 3: Exclude Holidays from Absent Count
- **File**: `supabase/migrations/20260530000002_exclude_holidays_from_absent_count.sql`
- **Purpose**: Updates attendance stats to exclude holidays from absent count
- **Impact**: Holidays won't count as absent days
- **Status**: ❌ NOT APPLIED

---

## 🔴 CRITICAL ISSUE: Email Mismatch

### Problem
User query shows email mismatch:
- **auth.users**: `soyebsheikh@gmail.com` (old email)
- **employee_profiles**: `atrayabdul.wes1@gmail.com` (new email)
- **Result**: User can only login with OLD email, not new email

### Root Cause
When admin updates email in Employees page, it only updated `employee_profiles` table, not `auth.users` table.

### Solution
Run the SQL in `FIX_EMAIL_MISMATCH.sql` to sync all existing mismatches.

**Quick Fix SQL**:
```sql
-- Fix all email mismatches (profile is source of truth)
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

After running this:
- User can login with `atrayabdul.wes1@gmail.com` ✓
- Old email `soyebsheikh@gmail.com` will no longer work

---

## 🔴 ISSUE: Password Update Failing

### Problem
- Admin changes password in Employees page
- Password updates successfully
- But user cannot login with new password (gets "Invalid credentials")

### Possible Causes
1. Edge function `update-user-password` not deployed or old version running
2. Password not being hashed correctly
3. Email confirmation flag not set

### Solutions

#### Option A: Redeploy Edge Function
1. Go to Supabase Dashboard → Edge Functions
2. Find `update-user-password`
3. Click "Redeploy"
4. Test password change

#### Option B: Manual Password Reset (Immediate Fix)
Use this SQL in Supabase SQL Editor:

```sql
-- Find user
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Reset password (replace USER_ID and NEW_PASSWORD)
UPDATE auth.users
SET 
  encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf')),
  updated_at = NOW()
WHERE id = 'USER_ID_HERE';
```

---

## 📋 ACTION CHECKLIST

### Immediate Actions (Do These Now)

- [ ] **1. Open Supabase SQL Editor**
  - Go to https://supabase.com/dashboard
  - Select your WES OneDesk project
  - Click "SQL Editor" → "New Query"

- [ ] **2. Fix Email Mismatches**
  - Copy SQL from `FIX_EMAIL_MISMATCH.sql`
  - Run in SQL Editor
  - Verify: Query should show 0 mismatches after fix

- [ ] **3. Add 2026 Holidays**
  - Copy SQL from `20260530000001_add_2026_holidays.sql`
  - Run in SQL Editor
  - Verify: `SELECT COUNT(*) FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026;` should return 15

- [ ] **4. Create Email Sync Function**
  - Copy SQL from `20260530000003_create_update_user_email_function.sql`
  - Run in SQL Editor
  - Verify: Function appears in database

- [ ] **5. Update Attendance Stats Function**
  - Copy SQL from `20260530000002_exclude_holidays_from_absent_count.sql`
  - Run in SQL Editor
  - Verify: Test with sample user

- [ ] **6. Fix Password Update**
  - Option A: Redeploy edge function in Supabase Dashboard
  - Option B: Use manual password reset SQL for immediate fix

---

## 📁 Reference Files

### For You to Use
1. **APPLY_MIGRATIONS_GUIDE.md** - Complete step-by-step guide with all SQL
2. **FIX_EMAIL_MISMATCH.sql** - SQL to fix email sync issue
3. **MANUAL_PASSWORD_RESET.sql** - SQL to manually reset passwords

### Migration Files (in supabase/migrations/)
1. `20260530000001_add_2026_holidays.sql`
2. `20260530000002_exclude_holidays_from_absent_count.sql`
3. `20260530000003_create_update_user_email_function.sql`

### Edge Function
- `supabase/functions/update-user-password/index.ts`

---

## 🎯 Expected Results After Applying All Fixes

1. ✅ All 2026 holidays display correctly in calendar
2. ✅ Holidays don't count as absent days
3. ✅ Email changes update both auth.users and employee_profiles
4. ✅ Users can login with their current profile email
5. ✅ Password changes work correctly
6. ✅ All attendance stats calculate correctly

---

## 🆘 If You Need Help

If you encounter any errors:
1. Copy the exact error message
2. Note which SQL query you were running
3. Let me know and I'll help troubleshoot

---

## 📊 System Health Check

After applying all fixes, run these verification queries:

```sql
-- 1. Check holidays
SELECT COUNT(*) FROM holidays WHERE EXTRACT(YEAR FROM date) = 2026;
-- Expected: 15

-- 2. Check email mismatches
SELECT COUNT(*) FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;
-- Expected: 0

-- 3. Check email sync function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'update_user_email_and_profile';
-- Expected: 1 row

-- 4. Check attendance stats function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'calculate_attendance_stats';
-- Expected: 1 row
```

---

**Last Updated**: May 30, 2026  
**Status**: Awaiting migration application
