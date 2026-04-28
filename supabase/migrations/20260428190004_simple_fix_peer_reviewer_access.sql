-- SIMPLEST FIX: Allow all authenticated users to view employee profiles
-- This is the quickest solution to fix "Unknown User" issue

-- Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.employee_profiles;

-- Create simple policy
CREATE POLICY "All authenticated users can view profiles"
ON public.employee_profiles FOR SELECT
TO authenticated
USING (true);

-- This allows:
-- ✅ Peer reviewers to see task response authors
-- ✅ Employees to see each other's names
-- ✅ Everyone to see basic profile info (name, email)

COMMENT ON POLICY "All authenticated users can view profiles" ON public.employee_profiles 
IS 'Allows all authenticated users to view employee profiles - fixes Unknown User issue';
