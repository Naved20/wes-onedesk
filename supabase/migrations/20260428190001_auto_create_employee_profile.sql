-- Automatically create employee_profile when a new user is created
-- This prevents "Unknown User" issue in the future

-- Create function to auto-create employee profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into employee_profiles
  INSERT INTO public.employee_profiles (
    user_id,
    first_name,
    last_name,
    email,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates employee_profile entry when a new user is created';
