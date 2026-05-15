# 🚨 URGENT: Run This Migration to Fix the Error

## Error You're Seeing
```
Could not find the 'other_allowance_percentage' column of 'salary_structures' in the schema cache
```

## Solution
Run the migration file: `20260515000005_add_other_allowance_percentage.sql`

## Steps to Fix

### 1️⃣ Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### 2️⃣ Copy and Paste This SQL
```sql
-- =====================================================
-- ADD OTHER_ALLOWANCE_PERCENTAGE TO SALARY_STRUCTURES
-- =====================================================

-- Drop the computed other_allowance column
ALTER TABLE salary_structures 
DROP COLUMN IF EXISTS other_allowance CASCADE;

-- Add other_allowance_percentage column
ALTER TABLE salary_structures
ADD COLUMN IF NOT EXISTS other_allowance_percentage DECIMAL(5, 2) DEFAULT 30.00;

-- Recreate other_allowance as a computed column based on percentage
ALTER TABLE salary_structures
ADD COLUMN other_allowance DECIMAL(10, 2) 
GENERATED ALWAYS AS (fixed_gross_salary * other_allowance_percentage / 100) STORED;

-- Add constraint for valid percentage
ALTER TABLE salary_structures
ADD CONSTRAINT valid_other_allowance_percentage 
CHECK (other_allowance_percentage >= 0 AND other_allowance_percentage <= 100);

-- Update comment
COMMENT ON COLUMN salary_structures.other_allowance_percentage IS 'Other allowance as percentage of Gross (typically 30%)';
COMMENT ON COLUMN salary_structures.other_allowance IS 'Computed: Gross × Other Allowance %';

-- Update existing records to have 30% as default
UPDATE salary_structures
SET other_allowance_percentage = 30.00
WHERE other_allowance_percentage IS NULL;
```

### 3️⃣ Click "Run" Button

### 4️⃣ Verify Success
You should see a success message. Now run this to verify:
```sql
-- Verify the column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'salary_structures'
  AND column_name = 'other_allowance_percentage';
```

Expected result: Should show the column exists with DECIMAL type.

### 5️⃣ Refresh Your Application
1. Close the salary structure dialog
2. Refresh the page (F5)
3. Try creating/editing a salary structure again
4. ✅ Error should be gone!

## What This Migration Does

1. **Drops** the old computed `other_allowance` column (it was calculated as balance)
2. **Adds** `other_allowance_percentage` column (editable, default 30%)
3. **Recreates** `other_allowance` as computed column based on percentage
4. **Updates** existing records to have 30% as default

## Before vs After

### Before (Old Schema)
```sql
other_allowance = Gross - Basic - HRA  -- Computed as balance
```

### After (New Schema)
```sql
other_allowance_percentage = 30.00  -- Editable field
other_allowance = Gross × 30%       -- Computed from percentage
```

## Why This Is Better

✅ **Editable**: Users can change the percentage (e.g., 25%, 30%, 35%)
✅ **Predictable**: Not just a balance, but a defined percentage
✅ **Flexible**: Each employee can have different percentages
✅ **Consistent**: Matches the UI form fields

## After Running Migration

You can now:
- ✅ Create new salary structures
- ✅ Edit existing salary structures
- ✅ Change Other Allowance % (e.g., from 30% to 25%)
- ✅ All calculations will work correctly

## Troubleshooting

### If you still see the error after migration:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check if migration ran successfully:
   ```sql
   SELECT * FROM salary_structures LIMIT 1;
   ```
   Should show `other_allowance_percentage` column

### If migration fails:
Check if there are existing salary structures with data:
```sql
SELECT COUNT(*) FROM salary_structures;
```

If count > 0, the migration might need adjustment. Contact support.
