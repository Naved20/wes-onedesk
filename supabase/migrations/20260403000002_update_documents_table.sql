-- Update documents table to make file fields nullable and add updated_at
ALTER TABLE documents 
ALTER COLUMN file_url DROP NOT NULL,
ALTER COLUMN file_name DROP NOT NULL,
ALTER COLUMN file_type DROP NOT NULL,
ALTER COLUMN file_size DROP NOT NULL;

-- Add updated_at column if not exists
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_by column to track who updated
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_timestamp ON documents;
CREATE TRIGGER update_documents_timestamp
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Update RLS policies to allow updates
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Admins and managers can update documents"
ON documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.user_id = auth.uid()
    AND employee_profiles.role IN ('admin', 'manager')
  )
);

-- Comment
COMMENT ON TABLE documents IS 'Stores company documents with title and rich text description';
