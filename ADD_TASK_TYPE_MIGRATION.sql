-- Migration to add type field to tasks table
-- Run this in Supabase SQL Editor

-- Add type column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS type TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN tasks.type IS 'Type of task: English Reading/listening/speaking, Lesson Plan & Delivery, or Soft & Digital Skills';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name = 'type';
