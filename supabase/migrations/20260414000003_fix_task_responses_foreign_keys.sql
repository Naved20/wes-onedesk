-- Fix foreign key relationships for task_responses and task_remarks
-- This allows proper joins with employee_profiles table

-- Drop existing foreign key constraints
ALTER TABLE task_responses 
DROP CONSTRAINT IF EXISTS task_responses_user_id_fkey;

ALTER TABLE task_remarks
DROP CONSTRAINT IF EXISTS task_remarks_remarked_by_fkey;

-- Add correct foreign keys to employee_profiles
ALTER TABLE task_responses
ADD CONSTRAINT task_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES employee_profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE task_remarks
ADD CONSTRAINT task_remarks_remarked_by_fkey 
FOREIGN KEY (remarked_by) 
REFERENCES employee_profiles(user_id) 
ON DELETE CASCADE;
