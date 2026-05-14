# Quick Fix Reference - Salary Duplicate Error

## ✅ FIXED: Duplicate Key Error in Salary Structure Setup

### What Was Fixed
The "duplicate key value violates unique constraint" error when saving salary structures.

### How to Use the Fix

#### 0️⃣ FIRST: Run Schema Migration (IMPORTANT!)
```sql
-- Open Supabase SQL Editor and run: 20260515000005_add_other_allowance_percentage.sql
-- OR copy the SQL from: RUN_THIS_MIGRATION.md
-- This adds the missing 'other_allowance_percentage' column
```
⚠️ **Without this step, you'll see**: "Could not find the 'other_allowance_percentage' column"

#### 1️⃣ Second: Run Cleanup (Run Once)
```sql
-- Open Supabase SQL Editor and run: CLEANUP_SALARY_DATA.sql
-- This removes duplicate structures and empty records
```

#### 2️⃣ Create New Salary Structure
1. Go to **Salaries & Earnings** → **Salary Structure Setup**
2. Click **Setup** on any employee
3. Fill in the form:
   - Fixed Gross Salary: ₹10,000
   - Basic %: 50%
   - HRA %: 40%
   - Other Allowance %: 30%
   - EPF %: 12%
   - ESIC %: 0.75%
4. Click **Save Salary Structure**
5. ✅ Success! No error!

#### 3️⃣ Edit Existing Salary Structure
1. Click **Setup** on the same employee again
2. Change any values (e.g., Fixed Gross Salary to ₹12,000)
3. Click **Save Salary Structure**
4. ✅ Success! Structure is updated (not duplicated)!

#### 4️⃣ Generate Salaries
```sql
-- Run in Supabase SQL Editor
SELECT generate_monthly_salaries(5, 2026);
```
✅ Salaries will be generated with correct base_salary values!

### What Changed
- **Before**: Always created new record → Duplicate error
- **After**: Updates existing record → No error!

### Files to Review
- ✅ **src/pages/Salaries.tsx** - Fixed handleSubmit function
- 📄 **CLEANUP_SALARY_DATA.sql** - Run this first
- 📖 **SALARY_SETUP_TEST_GUIDE.md** - Detailed testing guide
- 📋 **SALARY_FIX_SUMMARY.md** - Complete technical details

### Quick Verification
```sql
-- Check: Should show 0 or 1 active structure per user
SELECT user_id, COUNT(*) as active_count
FROM salary_structures
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates!)
```

### Need Help?
See **SALARY_SETUP_TEST_GUIDE.md** for:
- Step-by-step testing
- Common issues and solutions
- Formula reference
- Database schema details
