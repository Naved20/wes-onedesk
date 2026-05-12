-- Create face_attendance_sessions table to track all active sessions

CREATE TABLE IF NOT EXISTS public.face_attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  browser_name TEXT,
  os_name TEXT,
  device_type TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(10, 2),
  location_address TEXT,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  logout_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_face_sessions_active ON public.face_attendance_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_face_sessions_token ON public.face_attendance_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_face_sessions_login_time ON public.face_attendance_sessions(login_time DESC);

-- Add RLS policies
ALTER TABLE public.face_attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Admin can view all sessions
CREATE POLICY "Admins can view all face attendance sessions"
  ON public.face_attendance_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin can update sessions (for logout)
CREATE POLICY "Admins can update face attendance sessions"
  ON public.face_attendance_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Anyone can insert face attendance sessions (including unauthenticated Face Hub users)
CREATE POLICY "Anyone can insert face attendance sessions"
  ON public.face_attendance_sessions
  FOR INSERT
  TO public
  WITH CHECK (TRUE);

-- Anyone can update their own session (for activity tracking)
CREATE POLICY "Anyone can update face attendance sessions"
  ON public.face_attendance_sessions
  FOR UPDATE
  TO public
  USING (TRUE)
  WITH CHECK (TRUE);

-- Function to clean up old inactive sessions (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_face_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.face_attendance_sessions
  WHERE is_active = FALSE
  AND logout_time < NOW() - INTERVAL '30 days';
END;
$$;

-- Add comment
COMMENT ON TABLE public.face_attendance_sessions IS 'Tracks all Face Attendance Hub login sessions with device info and activity';
