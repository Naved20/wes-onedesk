-- Fix: Add INSERT policy for notifications table
-- Users and system functions need to insert notifications

-- Drop old admin policy if it exists and recreate it properly
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;

-- Create proper INSERT policy - allow authenticated users to insert (for system functions)
CREATE POLICY "Authenticated users and system can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Recreate admin ALL policy with INSERT included
CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also allow service role (Edge Functions) to insert
CREATE POLICY "Service role can manage notifications"
ON public.notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
