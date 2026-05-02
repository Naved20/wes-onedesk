# Task Category Migration Guide

## Overview
This migration adds a `category` field to the tasks table to help organize and filter tasks by subject/type (e.g., Soft Skills, Hindi, English, Mathematics, etc.).

## Steps to Run Migration

### 1. Open Supabase Dashboard
- Go to your Supabase project dashboard
- Navigate to the **SQL Editor** section

### 2. Run the Migration
- Copy the contents of `ADD_TASK_CATEGORY_MIGRATION.sql`
- Paste it into the SQL Editor
- Click **Run** to execute the migration

### 3. Verify Migration
Run this query to verify the column was added:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'category';
```

## What This Migration Does

1. **Adds `category` column** to the `tasks` table (TEXT type, nullable)
2. **Creates an index** on the category column for better query performance
3. **Adds documentation** via SQL comment

## Available Categories

The UI provides these predefined categories:
- Soft Skills
- Hindi
- English
- Mathematics
- Science
- Social Studies
- Computer Science
- Arts & Crafts
- Physical Education
- General
- Other

## Rollback (if needed)

If you need to remove the category column:
```sql
-- Remove index
DROP INDEX IF EXISTS idx_tasks_category;

-- Remove column
ALTER TABLE tasks DROP COLUMN IF EXISTS category;
```

## Notes
- Existing tasks will have `NULL` category (optional field)
- Category is optional when creating new tasks
- The migration is safe to run multiple times (uses IF NOT EXISTS)
