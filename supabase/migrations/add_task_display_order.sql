-- Add display_order column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_display_order ON tasks(display_order);

-- Update existing tasks with sequential order based on created_at
WITH ordered_tasks AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 as new_order
  FROM tasks
  WHERE is_active = true
)
UPDATE tasks
SET display_order = ordered_tasks.new_order
FROM ordered_tasks
WHERE tasks.id = ordered_tasks.id;
