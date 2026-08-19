-- Fix: Allow Admins and Managers to INSERT, UPDATE, and DELETE attendance records for all employees
-- Resolution for RLS error 42501 when Admin creates new attendance entry for blank dates or holidays

DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins and managers can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins and managers can insert attendance" ON public.attendance;

CREATE POLICY "Admins and managers can manage all attendance"
ON public.attendance FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);
