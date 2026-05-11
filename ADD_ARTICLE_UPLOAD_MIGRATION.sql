-- Migration to add article/vocabulary/notes and additional file upload fields to task_responses table
-- Run this in Supabase SQL Editor

-- Add new columns to task_responses table
ALTER TABLE task_responses
ADD COLUMN IF NOT EXISTS article_file_url TEXT,
ADD COLUMN IF NOT EXISTS article_file_name TEXT,
ADD COLUMN IF NOT EXISTS additional_file_url TEXT,
ADD COLUMN IF NOT EXISTS additional_file_name TEXT;

-- Add comments to describe the columns
COMMENT ON COLUMN task_responses.article_file_url IS 'URL for uploaded article, vocabulary, or handwritten notes file';
COMMENT ON COLUMN task_responses.article_file_name IS 'Original filename of the uploaded article/vocabulary/notes';
COMMENT ON COLUMN task_responses.additional_file_url IS 'URL for additional supporting file upload';
COMMENT ON COLUMN task_responses.additional_file_name IS 'Original filename of the additional file';

-- Update existing RLS policies (if any) to include new columns
-- No changes needed as RLS policies typically work on row level, not column level

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'task_responses'
AND column_name IN ('article_file_url', 'article_file_name', 'additional_file_url', 'additional_file_name');



