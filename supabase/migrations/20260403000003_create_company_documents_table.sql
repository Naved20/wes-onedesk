-- Create company_documents table for company-wide documents
CREATE TABLE IF NOT EXISTS public.company_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_documents_user_id ON company_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_created_at ON company_documents(created_at DESC);

-- Enable RLS
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view company documents"
ON company_documents FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create company documents"
ON company_documents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can update company documents"
ON company_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete company documents"
ON company_documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_documents_timestamp
  BEFORE UPDATE ON company_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_company_documents_updated_at();

-- Add comment
COMMENT ON TABLE company_documents IS 'Stores company-wide documents with title and rich text description';
