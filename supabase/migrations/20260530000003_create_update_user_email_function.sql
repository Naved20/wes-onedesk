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
