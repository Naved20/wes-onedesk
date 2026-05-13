-- Fix NULL task types by assigning default type
-- This will update all existing tasks that have NULL type

-- Option 1: Set all NULL types to a default value
-- Uncomment ONE of the following based on your preference:

-- Set all NULL types to "English Reading, listening & speaking Task"
-- UPDATE public.tasks 
-- SET type = 'English Reading, listening & speaking Task'
-- WHERE type IS NULL;

-- Set all NULL types to "Lesson Plan & Delivery"
-- UPDATE public.tasks 
-- SET type = 'Lesson Plan & Delivery'
-- WHERE type IS NULL;

-- Set all NULL types to "Soft & Digital Skills"
-- UPDATE public.tasks 
-- SET type = 'Soft & Digital Skills'
-- WHERE type IS NULL;

-- Option 2: Distribute NULL types evenly (recommended for testing)
-- This assigns types in a round-robin fashion
WITH numbered_tasks AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.tasks
  WHERE type IS NULL
)
UPDATE public.tasks
SET type = CASE 
  WHEN (SELECT rn FROM numbered_tasks WHERE numbered_tasks.id = tasks.id) % 3 = 0 
    THEN 'English Reading, listening & speaking Task'
  WHEN (SELECT rn FROM numbered_tasks WHERE numbered_tasks.id = tasks.id) % 3 = 1 
    THEN 'Lesson Plan & Delivery'
  ELSE 'Soft & Digital Skills'
END
WHERE type IS NULL;

-- Verify the update
SELECT 
  type,
  COUNT(*) as task_count
FROM public.tasks
GROUP BY type
ORDER BY type;

-- Optional: Make type column NOT NULL in future (uncomment if you want)
-- ALTER TABLE public.tasks 
-- ALTER COLUMN type SET NOT NULL;

-- Add a check constraint to ensure only valid types (uncomment if you want)
-- ALTER TABLE public.tasks
-- ADD CONSTRAINT valid_task_type CHECK (
--   type IN (
--     'English Reading, listening & speaking Task',
--     'Lesson Plan & Delivery',
--     'Soft & Digital Skills'
--   )
-- );
