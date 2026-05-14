-- Add document_type and link columns to company_documents
ALTER TABLE public.company_documents 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'Policy Documents',
ADD COLUMN IF NOT EXISTS document_link TEXT;

-- Create document_types table for custom types
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_document_types_type_name ON document_types(type_name);

-- Enable RLS
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_types
CREATE POLICY "Anyone can view document types"
ON document_types FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can create document types"
ON document_types FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete document types"
ON document_types FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Insert default document types
INSERT INTO public.document_types (type_name, created_by) 
VALUES 
  ('Policy Documents', NULL),
  ('Procedures', NULL),
  ('Guidelines', NULL),
  ('Forms', NULL),
  ('Reports', NULL)
ON CONFLICT (type_name) DO NOTHING;

-- Add comment
COMMENT ON TABLE document_types IS 'Stores custom document type categories that can be reused';
COMMENT ON COLUMN company_documents.document_type IS 'Category/type of the document';
COMMENT ON COLUMN company_documents.document_link IS 'External link URL for the document';
