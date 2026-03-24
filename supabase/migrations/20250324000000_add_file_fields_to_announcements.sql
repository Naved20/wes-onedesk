-- Add file attachment fields to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Create storage bucket for announcements if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for announcements bucket
CREATE POLICY "Anyone can view announcement files"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

CREATE POLICY "Authenticated users can upload announcement files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcements' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own announcement files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'announcements' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own announcement files"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcements' AND auth.role() = 'authenticated');
