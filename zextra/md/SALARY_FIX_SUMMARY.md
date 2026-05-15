# Salary System Fix Summary

## Problem
When trying to save or edit salary structures, users encountered a duplicate key error:
```
duplicate key value violates unique constraint "unique_active_salary_per_user"
```

## Root Cause
In `src/pages/Salaries.tsx`, the `handleSubmit` function always performed an INSERT operation, even when editing an existing salary structure. The logic was:
1. Set old structure to `is_active = false`
2. INSERT new structure with `is_active = true`

This caused issues because:
- The database constraint allows only ONE active salary structure per user
- If the UPDATE didn't complete properly, or if there were already duplicate active structures, the INSERT would fail
- This approach also created unnecessary historical records

## Solution Implemented

### 1. Fixed the handleSubmit Function (src/pages/Salaries.tsx)
Changed the logic to:
- **If editing existing structure**: UPDATE the existing record (no new insert)
- **If creating new structure**: 
  - First deactivate any existing active structures (cleanup)
  - Then INSERT the new structure

This ensures:
- Only ONE active structure per user at all times
- No unnecessary duplicate records
- Proper UPDATE behavior when editing

### 2. Added Missing Fields to salaryData Object
The fix also includes all required fields that were missing:
- `other_allowance_percentage`
- `epf_employee_rate`
- `epf_employer_rate`
- `esic_employee_rate`
- `esic_employer_rate`

### 3. Created Cleanup Script (CLEANUP_SALARY_DATA.sql)
This script:
- Identifies duplicate active salary structures
- Deactivates duplicates (keeps only the most recent one)
- Deletes empty salary records (base_salary = 0) from May 2026
- Provides verification queries

### 4. Created Test Guide (SALARY_SETUP_TEST_GUIDE.md)
Comprehensive testing guide that covers:
- Step-by-step testing process
- Verification checklist
- Common issues and solutions
- Database schema reference
- Formula reference

## Files Modified

### Modified Files
1. **src/pages/Salaries.tsx** (lines 280-350)
   - Fixed handleSubmit function to UPDATE instead of always INSERT
   - Added missing salary structure fields

### New Files Created
1. **CLEANUP_SALARY_DATA.sql**
   - Cleanup script for duplicate structures and empty records

2. **SALARY_SETUP_TEST_GUIDE.md**
   - Complete testing guide with verification steps

3. **SALARY_FIX_SUMMARY.md** (this file)
   - Summary of the fix and changes

## Testing Instructions

### Step 1: Run Cleanup
```sql
-- Execute CLEANUP_SALARY_DATA.sql in Supabase SQL Editor
```

### Step 2: Test Salary Structure Creation
1. Go to Salary Structure Setup tab
2. Select an employee
3. Fill in salary details
4. Click Save
5. **Expected**: Success message, no duplicate error

### Step 3: Test Salary Structure Editing
1. Click Setup on the same employee again
2. Modify the Fixed Gross Salary
3. Click Save
4. **Expected**: Success message, structure is updated (not duplicated)

### Step 4: Verify in Database
```sql
-- Should show only ONE active structure per user
SELECT user_id, COUNT(*) as active_count
FROM salary_structures
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### Step 5: Generate Salaries
```sql
SELECT generate_monthly_salaries(5, 2026);
```

### Step 6: Verify Generated Salaries
```sql
-- All records should have base_salary > 0
SELECT COUNT(*) as total,
       COUNT(CASE WHEN base_salary > 0 THEN 1 END) as with_salary,
       COUNT(CASE WHEN base_salary = 0 THEN 1 END) as without_salary
FROM salaries
WHERE month = 5 AND year = 2026;
```

## Benefits of This Fix

1. **No More Duplicate Errors**: Proper UPDATE logic prevents constraint violations
2. **Cleaner Data**: No unnecessary historical records for simple edits
3. **Better Performance**: UPDATE is faster than deactivate + insert
4. **Data Integrity**: Ensures only ONE active structure per user
5. **Complete Fields**: All required salary structure fields are now saved

## Migration Status

✅ **20260515000004_update_salary_generation_use_structure.sql** - Already applied
- Updates generate_monthly_salaries() function to use salary_structures table
- Calculates salaries based on attendance data

## Next Steps

1. ✅ Run CLEANUP_SALARY_DATA.sql to clean up existing duplicates
2. ✅ Test salary structure creation and editing
3. ✅ Configure salary structures for all employees
4. ✅ Generate salaries for current month
5. ✅ Verify calculations are correct

## Code Changes Detail

### Before (Buggy Code)
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // ... validation ...
  
  if (salaryStructure) {
    // Deactivate old structure
    await supabase
      .from("salary_structures")
      .update({ is_active: false })
      .eq("id", salaryStructure.id);
  }

  // Always INSERT (causes duplicate error!)
  const { error } = await supabase
    .from("salary_structures")
    .insert({ ...salaryData, is_active: true });
};
```

### After (Fixed Code)
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // ... validation ...
  
  if (salaryStructure) {
    // UPDATE existing structure (no duplicate!)
    const { error } = await supabase
      .from("salary_structures")
      .update(salaryData)
      .eq("id", salaryStructure.id);
  } else {
    // Cleanup any existing active structures first
    await supabase
      .from("salary_structures")
      .update({ is_active: false })
      .eq("user_id", selectedEmployee)
      .eq("is_active", true);

    // Then INSERT new structure
    const { error } = await supabase
      .from("salary_structures")
      .insert(salaryData);
  }
};
```

## Database Constraint Reference

```sql
-- This constraint ensures only ONE active salary structure per user
CONSTRAINT unique_active_salary_per_user UNIQUE (user_id, is_active)
```

This means:
- ✅ Multiple structures per user with `is_active = false` (historical records)
- ✅ ONE structure per user with `is_active = true` (current active structure)
- ❌ Multiple structures per user with `is_active = true` (VIOLATION!)

## Support

If you encounter any issues:
1. Check SALARY_SETUP_TEST_GUIDE.md for common issues
2. Run verification queries in CLEANUP_SALARY_DATA.sql
3. Ensure migration 20260515000004 is applied
4. Check browser console for detailed error messages
