-- Add link column to task_responses table
ALTER TABLE task_responses 
ADD COLUMN IF NOT EXISTS link TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN task_responses.link IS 'Optional link/URL submitted with the task response';
