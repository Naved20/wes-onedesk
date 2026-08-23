-- Create face_hub_geofence table for Face Attendance Geo-Fencing
CREATE TABLE IF NOT EXISTS public.face_hub_geofence (
    id TEXT PRIMARY KEY DEFAULT 'default_geofence',
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    latitude DOUBLE PRECISION NOT NULL DEFAULT 28.6139,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 77.2090,
    radius_meters INTEGER NOT NULL DEFAULT 200,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.face_hub_geofence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access for face_hub_geofence" ON public.face_hub_geofence;
DROP POLICY IF EXISTS "Allow public all access for face_hub_geofence" ON public.face_hub_geofence;

-- Create policies for reading and saving geofence configuration
CREATE POLICY "Allow public read access for face_hub_geofence"
    ON public.face_hub_geofence FOR SELECT
    USING (true);

CREATE POLICY "Allow public all access for face_hub_geofence"
    ON public.face_hub_geofence FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert initial default record if not present
INSERT INTO public.face_hub_geofence (id, is_enabled, latitude, longitude, radius_meters, address)
VALUES ('default_geofence', false, 28.6139, 77.2090, 200, 'Default Geofence Location')
ON CONFLICT (id) DO NOTHING;
