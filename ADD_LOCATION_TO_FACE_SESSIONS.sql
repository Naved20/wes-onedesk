-- Add location tracking columns to face_attendance_sessions table

-- Add latitude column
ALTER TABLE public.face_attendance_sessions 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Add longitude column
ALTER TABLE public.face_attendance_sessions 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add location accuracy column (in meters)
ALTER TABLE public.face_attendance_sessions 
ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(10, 2);

-- Add human-readable location address
ALTER TABLE public.face_attendance_sessions 
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add comments
COMMENT ON COLUMN public.face_attendance_sessions.latitude IS 'GPS latitude coordinate';
COMMENT ON COLUMN public.face_attendance_sessions.longitude IS 'GPS longitude coordinate';
COMMENT ON COLUMN public.face_attendance_sessions.location_accuracy IS 'Location accuracy in meters';
COMMENT ON COLUMN public.face_attendance_sessions.location_address IS 'Human-readable address from reverse geocoding';

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_face_sessions_location 
ON public.face_attendance_sessions(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
