-- Update documents table for employee documents
-- Add title column if not exists
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Update existing records to have title from document_name
UPDATE documents 
SET title = document_name 
WHERE title IS NULL;

-- Make title NOT NULL after populating
ALTER TABLE documents 
ALTER COLUMN title SET NOT NULL;

-- Add storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view their team documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Storage policies for employee documents
CREATE POLICY "Users can view their own employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Managers can view their team employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN employee_profiles ep ON ep.user_id = (storage.foldername(name))[1]::uuid
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'
    AND ep.institution_assignment IN (
      SELECT institution_name FROM manager_institutions
      WHERE manager_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload their own employee documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own employee documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Managers can view team documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- RLS Policies for documents table
CREATE POLICY "Users can view their own documents"
ON documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Managers can view their team documents"
ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN employee_profiles ep ON ep.user_id = documents.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'
    AND ep.institution_assignment IN (
      SELECT institution_name FROM manager_institutions
      WHERE manager_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert their own documents"
ON documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON documents FOR DELETE
USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE documents IS 'Employee personal documents (Aadhar, PAN, etc.) with title and file upload';
