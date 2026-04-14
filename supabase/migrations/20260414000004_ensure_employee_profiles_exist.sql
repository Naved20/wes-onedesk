-- Ensure all users have employee_profiles entries
-- This fixes the "Unknown User" issue

-- Insert missing employee_profiles for users who don't have them
INSERT INTO employee_profiles (user_id, first_name, last_name, email, created_at, updated_at)
SELECT 
  au.id as user_id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'User') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', au.email) as last_name,
  au.email,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN employee_profiles ep ON ep.user_id = au.id
WHERE ep.user_id IS NULL;
