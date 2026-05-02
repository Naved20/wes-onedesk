-- Add category column to tasks table
-- This migration adds a category field to help organize tasks by subject/type

-- Add category column
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index for better query performance when filtering by category
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- Add comment to document the column
COMMENT ON COLUMN tasks.category IS 'Category of the task (e.g., Soft Skills, Hindi, English, Mathematics, etc.)';
