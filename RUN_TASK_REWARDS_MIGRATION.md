# Task Rewards System Migration Guide

## Overview
This migration adds a complete reward system to tasks where:
1. Admins can set reward amounts when creating/editing tasks
2. Employees earn money when their task responses are reviewed and approved
3. Earnings are tracked in a dedicated table
4. Employees can view their earnings history

## Steps to Run Migration

### 1. Open Supabase Dashboard
- Go to your Supabase project dashboard
- Navigate to the **SQL Editor** section

### 2. Run the Migration
**Option A - Recommended (Simplified):**
- Copy the contents of `ADD_TASK_REWARDS_MIGRATION_SIMPLE.sql`
- Paste it into the SQL Editor
- Click **Run** to execute the migration

**Option B - Advanced (with role-based policies):**
- Copy the contents of `ADD_TASK_REWARDS_MIGRATION.sql`
- Paste it into the SQL Editor
- Click **Run** to execute the migration
- Note: This requires `role` column in `employee_profiles` table

### 3. Verify Migration
Run these queries to verify:

```sql
-- Check reward_amount column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'reward_amount';

-- Check task_earnings table was created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'task_earnings';

-- Check indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'task_earnings';
```

## What This Migration Does

### 1. Tasks Table Updates
- **Adds `reward_amount` column** (DECIMAL(10, 2), nullable)
- Stores reward in rupees (e.g., 100.50)

### 2. Task Earnings Table
Creates a new table to track all earnings:
- `id`: Unique identifier
- `task_id`: Reference to the task
- `response_id`: Reference to the task response
- `user_id`: Employee who earned the reward
- `amount`: Reward amount earned
- `remark_id`: Reference to the remark that approved it
- `remarked_by`: Admin/reviewer who approved
- `earned_at`: Timestamp when earned
- `status`: pending | approved | paid
- `created_at`, `updated_at`: Timestamps

### 3. Row Level Security (RLS)
Policies added:
- ✅ Employees can view their own earnings
- ✅ Admins/managers can view all earnings
- ✅ Admins can insert earnings (when approving)
- ✅ Admins can update earnings status

### 4. Indexes
For better performance:
- `idx_task_earnings_user_id`
- `idx_task_earnings_task_id`
- `idx_task_earnings_status`
- `idx_task_earnings_earned_at`

## How the Reward System Works

### For Admins:
1. Create/edit task with reward amount (optional)
2. When reviewing employee responses, add remarks
3. System automatically creates earning record when remark is added (if task has reward)
4. Can approve/mark earnings as paid

### For Employees:
1. Complete tasks that have rewards
2. Submit response
3. Wait for admin/peer reviewer to review
4. When reviewed with positive remark, earning is created
5. View earnings in Earnings page/tab

## Earnings Status Flow
```
pending → approved → paid
```

- **pending**: Response submitted, awaiting review
- **approved**: Reviewed and approved, awaiting payment
- **paid**: Payment completed

## Rollback (if needed)

If you need to remove the reward system:

```sql
-- Drop task_earnings table
DROP TABLE IF EXISTS task_earnings CASCADE;

-- Remove reward_amount column
ALTER TABLE tasks DROP COLUMN IF EXISTS reward_amount;
```

## Notes
- Reward amount is optional (can be NULL)
- Existing tasks will have NULL reward_amount
- Earnings are created automatically when remarks are added to responses for tasks with rewards
- The migration is safe to run multiple times (uses IF NOT EXISTS)
