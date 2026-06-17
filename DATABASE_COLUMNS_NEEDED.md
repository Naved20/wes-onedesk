# Database Columns - Weekly Reports

## ⚠️ Important: Check Your Actual Database Schema

The code is now configured to work with these columns. **Please verify your database has these exact columns:**

## Required Columns in `weekly_reports` Table

Run this SQL in Supabase to check your table structure:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'weekly_reports'
ORDER BY ordinal_position;
```

## Expected Columns

| Column Name | Type | Nullable | Notes |
|-------------|------|----------|-------|
| id | UUID | NO | Primary key |
| employee_id | UUID | NO | FK to auth.users |
| employee_name | VARCHAR/TEXT | NO | Employee full name |
| week_starting | DATE | NO | Start date of week |
| week_ending | DATE | NO | End date of week |
| objectives | TEXT | YES | What was accomplished |
| hours_spent | NUMERIC/INTEGER | YES | Hours worked |
| tasks_completed | INTEGER | YES | Number of tasks done |
| status | VARCHAR | YES | in_progress/completed/blocked |
| approval_status | VARCHAR | YES | pending/approved/rejected |
| manager_notes | TEXT | YES | Manager feedback |
| manager_rating | INTEGER | YES | 1-5 rating (OPTIONAL - not queried if missing) |
| created_at | TIMESTAMP | YES | Auto-generated |
| updated_at | TIMESTAMP | YES | Auto-generated |

## Currently NOT Using These Fields
- `department` - Removed from queries
- `manager_rating` - Temporarily disabled (column may not exist)

## If Columns Are Missing

### Option 1: Add Missing Columns (Recommended)
```sql
-- Add employee_name if missing
ALTER TABLE weekly_reports 
ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255) NOT NULL DEFAULT 'Unknown';

-- Add manager_rating if you want ratings feature
ALTER TABLE weekly_reports 
ADD COLUMN IF NOT EXISTS manager_rating INTEGER CHECK (manager_rating >= 1 AND manager_rating <= 5);

-- Add manager_notes if missing
ALTER TABLE weekly_reports 
ADD COLUMN IF NOT EXISTS manager_notes TEXT;
```

### Option 2: Modify Code to Match Your Schema
If your database uses different column names, update:
- `src/types/weeklyReport.ts` - Interface definitions
- `src/services/weeklyReportService.ts` - All queries

## Common Issues

### Issue: `employee_name` is required but null
**Solution**: Form now includes employee_name field. It will auto-fill from user's email.

### Issue: `manager_rating` column doesn't exist
**Solution**: Stats query now works without this column. Rating will show "N/A".

### Issue: Invalid date format
**Solution**: Code now checks if dates exist before formatting.

## Testing Your Setup

1. Create a test report via the UI
2. Check Supabase table browser to see what data was saved
3. Verify all required fields have values
4. Check for any database errors in browser console

## Next Steps

Once you confirm your database structure:
1. Update this document with actual column names if different
2. Test employee report creation
3. Test manager review flow
4. Enable manager_rating if column exists

---

**Status**: Code is ready, waiting for database column verification
**Last Updated**: June 17, 2026
