-- Fix missing employee_profiles for existing users
-- This will create employee_profiles entries for users who submitted task responses

-- Insert missing employee_profiles for users who don't have them
INSERT INTO employee_profiles (user_id, first_name, last_name, email, created_at, updated_at)
SELECT 
  au.id as user_id,
  COALESCE(au.raw_user_meta_data->>'first_name', SPLIT_PART(au.email, '@', 1)) as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', 'User') as last_name,
  au.email,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN employee_profiles ep ON ep.user_id = au.id
WHERE ep.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Log the fix
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM auth.users au
  LEFT JOIN employee_profiles ep ON ep.user_id = au.id
  WHERE ep.user_id IS NULL;
  
  RAISE NOTICE 'Created employee_profiles for % missing users', missing_count;
END $$;
