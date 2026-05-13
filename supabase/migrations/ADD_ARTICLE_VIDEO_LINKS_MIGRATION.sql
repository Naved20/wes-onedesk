-- Add article_link and video_link columns to task_responses table
-- This replaces the file upload fields with link fields

-- Add new columns
ALTER TABLE public.task_responses 
ADD COLUMN IF NOT EXISTS article_link TEXT,
ADD COLUMN IF NOT EXISTS video_link TEXT;

-- Add comments
COMMENT ON COLUMN public.task_responses.article_link IS 'Link to article, vocabulary, or handwritten notes (Google Drive, Docs, etc.)';
COMMENT ON COLUMN public.task_responses.video_link IS 'Link to video submission (YouTube, Google Drive, etc.)';

-- Optional: If you want to migrate existing article_file_url and additional_file_url to links
-- Uncomment the following if you want to copy existing file URLs to the new link fields
-- UPDATE public.task_responses 
-- SET article_link = article_file_url 
-- WHERE article_file_url IS NOT NULL AND article_link IS NULL;

-- UPDATE public.task_responses 
-- SET video_link = additional_file_url 
-- WHERE additional_file_url IS NOT NULL AND video_link IS NULL;
