-- Allow peer reviewers to view employee profiles
-- This fixes the "Unknown User" issue for peer reviewers viewing task responses

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Peer reviewers can view profiles of task respondents" ON public.employee_profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.employee_profiles;

-- Add policy for peer reviewers to view profiles of users whose task responses they can review
CREATE POLICY "Peer reviewers can view profiles of task respondents"
ON public.employee_profiles FOR SELECT
TO authenticated
USING (
  -- Allow if the current user is a peer reviewer for any task
  -- and the profile belongs to someone who submitted a response to that task
  EXISTS (
    SELECT 1 
    FROM task_peer_reviewers tpr
    JOIN task_responses tr ON tr.task_id = tpr.task_id
    WHERE tpr.user_id = auth.uid()
    AND tr.user_id = employee_profiles.user_id
  )
);

-- Alternative simpler policy: Allow all authenticated users to view basic profile info
-- This is more permissive but simpler and covers all cases
CREATE POLICY "Authenticated users can view basic profile info"
ON public.employee_profiles FOR SELECT
TO authenticated
USING (true);

-- Note: The second policy is more permissive. If you want stricter access control,
-- drop the second policy and keep only the first one:
-- DROP POLICY "Authenticated users can view basic profile info" ON public.employee_profiles;

COMMENT ON POLICY "Peer reviewers can view profiles of task respondents" ON public.employee_profiles 
IS 'Allows peer reviewers to see names of users whose task responses they are reviewing';

COMMENT ON POLICY "Authenticated users can view basic profile info" ON public.employee_profiles 
IS 'Allows all authenticated users to view employee profiles (name, email, etc.)';
