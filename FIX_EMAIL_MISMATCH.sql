-- ============================================================================
-- FIX EMAIL MISMATCH BETWEEN auth.users AND employee_profiles
-- ============================================================================
-- Problem: User can only login with old email (soyebsheikh@gmail.com) 
-- but profile shows new email (atrayabdul.wes1@gmail.com)
-- 
-- This happens when admin updates email in employee_profiles but auth.users 
-- email stays unchanged.
-- ============================================================================

-- STEP 1: Check current email mismatches
-- This will show all users where auth email != profile email
SELECT 
  ep.user_id,
  au.email AS auth_email,
  ep.email AS profile_email,
  ep.first_name,
  ep.last_name,
  'User can only login with: ' || au.email AS note
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email
ORDER BY ep.first_name;

-- Expected output: Shows users with email mismatch
-- Example:
-- user_id | auth_email              | profile_email              | first_name | last_name
-- --------|-------------------------|----------------------------|------------|----------
-- abc123  | soyebsheikh@gmail.com   | atrayabdul.wes1@gmail.com  | Soyeb      | Sheikh


-- ============================================================================
-- STEP 2: Fix all email mismatches
-- This updates auth.users to match employee_profiles (profile is source of truth)
-- ============================================================================

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

-- This will return: "UPDATE X" where X is the number of users fixed


-- ============================================================================
-- STEP 3: Verify fix - should return 0 rows
-- ============================================================================

SELECT 
  ep.user_id,
  au.email AS auth_email,
  ep.email AS profile_email,
  ep.first_name,
  ep.last_name
FROM employee_profiles ep
JOIN auth.users au ON au.id = ep.user_id
WHERE au.email != ep.email;

-- Expected output: 0 rows (no mismatches)


-- ============================================================================
-- STEP 4: Verify specific user can now login with new email
-- ============================================================================

-- Check the specific user mentioned in the issue
SELECT 
  au.id,
  au.email AS auth_email,
  ep.email AS profile_email,
  ep.first_name,
  ep.last_name,
  'User can now login with: ' || au.email AS note
FROM auth.users au
JOIN employee_profiles ep ON ep.user_id = au.id
WHERE au.email LIKE '%atrayabdul%' OR au.email LIKE '%soyeb%'
   OR ep.email LIKE '%atrayabdul%' OR ep.email LIKE '%soyeb%';

-- Expected: Both auth_email and profile_email should match


-- ============================================================================
-- OPTIONAL: Fix a specific user only (if you don't want to fix all)
-- ============================================================================

-- Replace 'USER_ID_HERE' with the actual user_id
/*
UPDATE auth.users
SET 
  email = (SELECT email FROM employee_profiles WHERE user_id = 'USER_ID_HERE'),
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    to_jsonb((SELECT email FROM employee_profiles WHERE user_id = 'USER_ID_HERE'))
  ),
  updated_at = NOW()
WHERE id = 'USER_ID_HERE';
*/


-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. After running this, users should login with their PROFILE email
-- 2. Old email will no longer work for login
-- 3. This is a one-time fix for existing mismatches
-- 4. To prevent future mismatches, apply migration:
--    20260530000003_create_update_user_email_function.sql
-- 5. The frontend already calls the RPC function when email is changed
-- ============================================================================
