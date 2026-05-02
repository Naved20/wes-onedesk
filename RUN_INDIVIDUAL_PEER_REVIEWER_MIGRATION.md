# Individual Peer Reviewer Assignment Migration

This migration adds support for 1:1 peer reviewer assignments alongside the existing group-based system.

## SQL Migration

Run the following SQL in your Supabase SQL editor:

```sql
-- Create table for individual peer reviewer assignments
CREATE TABLE IF NOT EXISTS individual_peer_reviewers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_individual_peer_reviewers_user_id ON individual_peer_reviewers(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_peer_reviewers_reviewer_id ON individual_peer_reviewers(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_individual_peer_reviewers_active ON individual_peer_reviewers(is_active);

-- Add unique constraint to prevent duplicate active assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_individual_peer_reviewers_unique_active 
ON individual_peer_reviewers(user_id) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE individual_peer_reviewers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own peer reviewer assignments" ON individual_peer_reviewers
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = reviewer_id OR
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins and managers can manage peer reviewer assignments" ON individual_peer_reviewers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Add trigger for updated_at
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

-- Add column to tasks table to indicate review assignment type
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_assignment_type VARCHAR(20) DEFAULT 'group' CHECK (review_assignment_type IN ('group', 'individual', 'mixed'));

-- Add comment for documentation
COMMENT ON TABLE individual_peer_reviewers IS 'Stores 1:1 peer reviewer assignments where each user has a specific designated reviewer';
COMMENT ON COLUMN individual_peer_reviewers.user_id IS 'The user who will be reviewed';
COMMENT ON COLUMN individual_peer_reviewers.reviewer_id IS 'The user who will do the reviewing';
COMMENT ON COLUMN individual_peer_reviewers.assigned_by IS 'Admin/manager who made this assignment';
COMMENT ON COLUMN individual_peer_reviewers.is_active IS 'Whether this assignment is currently active';
COMMENT ON COLUMN individual_peer_reviewers.notes IS 'Optional notes about this assignment';
COMMENT ON COLUMN tasks.review_assignment_type IS 'Type of peer review assignment: group (existing), individual (1:1), or mixed (both)';
```

## Verification

After running the migration, verify the table was created:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'individual_peer_reviewers'
ORDER BY ordinal_position;
```

## Next Steps

1. Update TypeScript types in `src/integrations/supabase/types.ts`
2. Create UI components for managing individual assignments
3. Update task assignment flow to support individual reviewers
4. Add admin interface for viewing/managing all assignments