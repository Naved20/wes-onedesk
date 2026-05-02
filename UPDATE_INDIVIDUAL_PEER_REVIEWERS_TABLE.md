# Update Individual Peer Reviewers Table for Task-Specific Assignments

## Problem
Current table structure is for global assignments, but we need task-specific assignments where each task can have different user-to-reviewer mappings.

## Solution
Update the table to include `task_id` and remove the `is_active` constraint since assignments are now task-specific.

## SQL to Run

```sql
-- Step 1: Drop the old table if it exists (since we just created it)
DROP TABLE IF EXISTS individual_peer_reviewers CASCADE;

-- Step 2: Create the new task-specific table
CREATE TABLE individual_peer_reviewers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for better performance
CREATE INDEX idx_individual_peer_reviewers_task_id ON individual_peer_reviewers(task_id);
CREATE INDEX idx_individual_peer_reviewers_user_id ON individual_peer_reviewers(user_id);
CREATE INDEX idx_individual_peer_reviewers_reviewer_id ON individual_peer_reviewers(reviewer_id);

-- Step 4: Add unique constraint to prevent duplicate assignments per task
CREATE UNIQUE INDEX idx_individual_peer_reviewers_unique_per_task 
ON individual_peer_reviewers(task_id, user_id);

-- Step 5: Enable RLS
ALTER TABLE individual_peer_reviewers ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
CREATE POLICY "Users can view peer reviewer assignments for tasks they're involved in" 
ON individual_peer_reviewers
FOR SELECT 
USING (
    auth.uid() = user_id OR 
    auth.uid() = reviewer_id OR
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admins and managers can manage peer reviewer assignments" 
ON individual_peer_reviewers
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
);

-- Step 7: Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_individual_peer_reviewers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_individual_peer_reviewers_updated_at
    BEFORE UPDATE ON individual_peer_reviewers
    FOR EACH ROW
    EXECUTE FUNCTION update_individual_peer_reviewers_updated_at();

-- Step 8: Add comments for documentation
COMMENT ON TABLE individual_peer_reviewers IS 'Stores task-specific 1:1 peer reviewer assignments where each user has a designated reviewer for a particular task';
COMMENT ON COLUMN individual_peer_reviewers.task_id IS 'The task for which this reviewer assignment applies';
COMMENT ON COLUMN individual_peer_reviewers.user_id IS 'The user who will be reviewed';
COMMENT ON COLUMN individual_peer_reviewers.reviewer_id IS 'The user who will do the reviewing';
COMMENT ON COLUMN individual_peer_reviewers.assigned_by IS 'Admin/manager who made this assignment';
COMMENT ON COLUMN individual_peer_reviewers.notes IS 'Optional notes about this assignment';
```

## Verification

After running the migration, verify the table structure:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'individual_peer_reviewers'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- task_id (uuid) - NEW!
- user_id (uuid)
- reviewer_id (uuid)
- assigned_by (uuid)
- assigned_at (timestamp)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

## Key Changes

1. ✅ Added `task_id` column - Now assignments are task-specific
2. ✅ Removed `is_active` column - Not needed for task-specific assignments
3. ✅ Updated unique constraint - Now per task, not global
4. ✅ Updated RLS policies - Simplified for task-based access
5. ✅ Added foreign key to tasks table - Ensures data integrity

## How It Works Now

**Before (Global):**
- User A → Reviewer B (for all tasks)
- User C → Reviewer D (for all tasks)

**After (Task-Specific):**
- Task 1: User A → Reviewer B, User C → Reviewer D
- Task 2: User A → Reviewer C, User C → Reviewer B
- Each task can have different reviewer assignments!

This gives maximum flexibility! 🎯
