-- Add applicable_institutes column to company_documents table
-- Run this query in Supabase SQL Editor

-- Step 1: Add the column without default
ALTER TABLE company_documents
ADD COLUMN applicable_institutes TEXT[];

-- Step 2: Set default values for existing rows
UPDATE company_documents 
SET applicable_institutes = ARRAY['WES', 'DPS', 'CLAS', 'WESA']
WHERE applicable_institutes IS NULL;

-- Step 3: Add constraint to make it not null with default
ALTER TABLE company_documents
ALTER COLUMN applicable_institutes SET NOT NULL,
ALTER COLUMN applicable_institutes SET DEFAULT ARRAY['WES', 'DPS', 'CLAS', 'WESA'];

-- Step 4: Create index for better query performance
CREATE INDEX idx_company_documents_institutes ON company_documents USING GIN (applicable_institutes);
