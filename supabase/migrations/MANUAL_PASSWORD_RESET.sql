-- Manual Password Reset Script
-- Use this to reset a user's password directly via SQL Editor

-- Step 1: Find the user by email
-- Replace 'user@example.com' with actual email
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'atrayabdul.wes1@gmail.com';  -- Replace with actual email

-- Step 2: Reset password using admin function
-- Replace 'USER_ID_HERE' with the id from Step 1
-- Replace 'NEW_PASSWORD_HERE' with the new password (min 6 characters)

-- This will update the password and allow immediate login
-- Run this in Supabase SQL Editor:

/*
SELECT auth.admin_update_user_by_id(
  'USER_ID_HERE'::uuid,
  jsonb_build_object(
    'password', 'NEW_PASSWORD_HERE',
    'email_confirm', true
  )
);
*/

-- Example:
-- SELECT auth.admin_update_user_by_id(
--   '92cb61ac-beef-4c5f-8eb1-51857859244e'::uuid,
--   jsonb_build_object(
--     'password', 'newpass123',
--     'email_confirm', true
--   )
-- );

-- Step 3: Verify the update
-- Check if password was updated (updated_at should be recent)
SELECT 
  id,
  email,
  updated_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'atrayabdul.wes1@gmail.com';  -- Replace with actual email

-- If email_confirmed_at is NULL, run this:
/*
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'atrayabdul.wes1@gmail.com';  -- Replace with actual email
*/
