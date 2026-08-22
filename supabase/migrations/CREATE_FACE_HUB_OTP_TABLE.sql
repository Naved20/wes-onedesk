-- Create face_hub_otp table for 60-second dynamic OTP authentication
CREATE TABLE IF NOT EXISTS public.face_hub_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_used BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.face_hub_otp ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can select face hub otp" ON public.face_hub_otp;
DROP POLICY IF EXISTS "Public can insert face hub otp" ON public.face_hub_otp;
DROP POLICY IF EXISTS "Public can update face hub otp" ON public.face_hub_otp;

-- Create policies for public access (Admin and Device Login)
CREATE POLICY "Public can select face hub otp"
  ON public.face_hub_otp
  FOR SELECT
  TO public
  USING (TRUE);

CREATE POLICY "Public can insert face hub otp"
  ON public.face_hub_otp
  FOR INSERT
  TO public
  WITH CHECK (TRUE);

CREATE POLICY "Public can update face hub otp"
  ON public.face_hub_otp
  FOR UPDATE
  TO public
  USING (TRUE)
  WITH CHECK (TRUE);
