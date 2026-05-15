# How to Run the Salary Migrations

## Quick Start

The frontend code is complete and ready. Now you need to run 2 database migrations to make it work.

---

## Step 1: Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

---

## Step 2: Run Migration 1 - Add Columns

**File**: `supabase/migrations/20260515000007_add_complete_salary_columns.sql`

1. Open the file in your editor
2. Copy ALL the content
3. Paste into Supabase SQL Editor
4. Click **Run** (or Ctrl+Enter)
5. Wait for success message

**What it does**:
- Adds 20+ new columns to salaries table
- Adds indexes for performance
- Updates existing records with default values

---

## Step 3: Run Migration 2 - Update Function

**File**: `supabase/migrations/20260515000008_update_generate_with_complete_structure.sql`

1. Click **New Query** (create a new query)
2. Open the file in your editor
3. Copy ALL the content
4. Paste into Supabase SQL Editor
5. Click **Run** (or Ctrl+Enter)
6. Wait for success message

**What it does**:
- Updates `generate_monthly_salaries()` function
- Now calculates complete salary breakdown
- Stores all components in database

---

## Step 4: Verify Migrations Ran Successfully

Run this query to verify:

```sql
-- Check if new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'salaries' 
AND column_name IN ('basic_earned', 'hra_earned', 'variable_earnings_details', 'epf_employee', 'total_ctc')
ORDER BY column_name;
```

**Expected Result**: Should return 5 rows with these column names:
- basic_earned
- epf_employee
- hra_earned
- total_ctc
- variable_earnings_details

If you see 5 rows, migrations ran successfully! ✅

---

## Step 5: Test Salary Generation

Run this to test the updated function:

```sql
-- Generate salaries for May 2026
SELECT generate_monthly_salaries(2026, 5);
```

**Expected Result**:
```json
{
  "success": true,
  "created": 10,
  "skipped": 0,
  "working_days": 26,
  "message": "Generated 10 salary records with complete breakdown..."
}
```

---

## Step 6: Verify Generated Data

Check if salaries were generated with complete breakdown:

```sql
SELECT 
  s.id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.base_salary,
  s.working_days,
  s.present_days,
  s.basic_earned,
  s.hra_earned,
  s.other_allowance_earned,
  s.gross_salary,
  s.epf_employee,
  s.esic_employee,
  s.total_deductions,
  s.net_salary_calculated,
  s.epf_employer,
  s.esic_employer,
  s.total_ctc
FROM salaries s
JOIN employee_profiles ep ON s.user_id = ep.user_id
WHERE s.month = 5 AND s.year = 2026
LIMIT 1;
```

**Expected**: All columns should have values (not NULL)

---

## Troubleshooting

### Error: "Column already exists"
- This is fine! The migration uses `IF NOT EXISTS`
- Just means the column was already added
- Continue to next step

### Error: "Function already exists"
- This is fine! The migration uses `CREATE OR REPLACE`
- Just means the function was already updated
- Continue to next step

### Error: "Syntax error"
- Make sure you copied the ENTIRE file content
- Check for any missing parts
- Try copying again

### No rows returned from verification query
- Migrations didn't run successfully
- Check for error messages in Supabase
- Try running migrations again

---

## After Migrations

Once migrations are complete:

1. ✅ Go to Salary Management page
2. ✅ Click "Generate Salaries"
3. ✅ Click edit on any salary
4. ✅ You should see the new complete dialog with:
   - Attendance Summary
   - Fixed Salary Structure
   - Variable Earnings
   - Deductions
   - Live Calculation panel

---

## Need Help?

If migrations fail:

1. Check Supabase error message
2. Verify you copied the entire file
3. Try running one migration at a time
4. Check that salary_structures table exists
5. Check that earning_types table exists

