-- STRICT VERSION: Only allow peer reviewers to view profiles in specific contexts
-- Use this if you want more controlled access

-- First, drop the permissive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.employee_profiles;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Peer reviewers can view task response authors" ON public.employee_profiles;
DROP POLICY IF EXISTS "Peer reviewers can view profiles of task respondents" ON public.employee_profiles;

-- Keep only the strict peer reviewer policy
-- Ensure peer reviewers can view profiles ONLY for task responses they are reviewing
CREATE POLICY "Peer reviewers can view task response authors"
ON public.employee_profiles FOR SELECT
TO authenticated
USING (
  -- User can view their own profile
  auth.uid() = user_id
  OR
  -- Admins can view all
  public.has_role(auth.uid(), 'admin')
  OR
  -- Managers can view team profiles
  (
    public.has_role(auth.uid(), 'manager') 
    AND public.is_manager_of_institution(auth.uid(), institution_assignment)
  )
  OR
  -- Peer reviewers can view profiles of users whose responses they review
  EXISTS (
    SELECT 1 
    FROM task_peer_reviewers tpr
    JOIN task_responses tr ON tr.task_id = tpr.task_id
    WHERE tpr.user_id = auth.uid()
    AND tr.user_id = employee_profiles.user_id
  )
  OR
  -- Users assigned to same task can see each other
  EXISTS (
    SELECT 1
    FROM task_assignments ta1
    JOIN task_assignments ta2 ON ta1.task_id = ta2.task_id
    WHERE ta1.user_id = auth.uid()
    AND ta2.user_id = employee_profiles.user_id
  )
);

COMMENT ON POLICY "Peer reviewers can view task response authors" ON public.employee_profiles 
IS 'Strict policy: Users can only view profiles in specific task-related contexts';
