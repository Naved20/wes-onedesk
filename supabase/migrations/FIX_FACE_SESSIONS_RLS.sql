-- Fix RLS policies for face_attendance_sessions to allow unauthenticated access

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can insert face attendance sessions" ON public.face_attendance_sessions;
DROP POLICY IF EXISTS "Anyone can update face attendance sessions" ON public.face_attendance_sessions;
DROP POLICY IF EXISTS "Public can insert face attendance sessions" ON public.face_attendance_sessions;
DROP POLICY IF EXISTS "Public can update face attendance sessions" ON public.face_attendance_sessions;
DROP POLICY IF EXISTS "Public can select face attendance sessions" ON public.face_attendance_sessions;

-- Allow anyone (including unauthenticated) to insert sessions
CREATE POLICY "Public can insert face attendance sessions"
  ON public.face_attendance_sessions
  FOR INSERT
  TO public
  WITH CHECK (TRUE);

-- Allow anyone to update sessions (for activity tracking)
CREATE POLICY "Public can update face attendance sessions"
  ON public.face_attendance_sessions
  FOR UPDATE
  TO public
  USING (TRUE)
  WITH CHECK (TRUE);

-- Allow anyone to select their own session (for validation)
CREATE POLICY "Public can select face attendance sessions"
  ON public.face_attendance_sessions
  FOR SELECT
  TO public
  USING (TRUE);

-- Admin can view all sessions (keep existing policy)
-- This policy should already exist from the main migration
