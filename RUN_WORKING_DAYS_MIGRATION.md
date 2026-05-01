# Working Days Calculation Update - Migration Guide

## Overview
This migration updates the working days calculation to properly handle:
1. **Sundays** - Excluded from working days count
2. **Holidays** - Excluded from working days count (both all-institution and institution-specific)

## What Changed

### Before:
- Working days calculation might not have properly excluded all holidays
- Institution-specific holidays were not supported

### After:
- ✅ Sundays are excluded
- ✅ All holidays (both general and institution-specific) are excluded
- ✅ New function `calculate_working_days_for_institution()` for institution-aware calculations

## How to Run Migration

### Step 1: Run Holiday Institution Migration First
**IMPORTANT:** You must run the holiday institution migration first!
See: `RUN_HOLIDAY_INSTITUTION_MIGRATION.md`

### Step 2: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** from the left sidebar

### Step 3: Run the Working Days Migration
1. Click on **New Query**
2. Copy the entire content from: `supabase/migrations/20260501000001_update_working_days_with_institutions.sql`
3. Paste it in the SQL editor
4. Click **Run** button

### Step 4: Verify Migration
Run this query to test the function:
```sql
-- Test working days calculation for current month
SELECT calculate_working_days(
  DATE_TRUNC('month', CURRENT_DATE)::DATE,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
) as working_days_this_month;

-- Test institution-specific working days
SELECT calculate_working_days_for_institution(
  DATE_TRUNC('month', CURRENT_DATE)::DATE,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
  'Your Institution Name'
) as institution_working_days;
```

## How It Works

### Working Days Calculation:
```
Total Days in Month
  - Sundays
  - Holidays (all institutions)
  - Holidays (specific institution)
= Working Days
```

### Example for January 2026 (31 days):
```
31 total days
- 4 Sundays (5, 12, 19, 26)
- 2 National holidays (Republic Day on 26th, Makar Sankranti on 14th)
= 25 working days
```

### Holiday Types:
1. **All Institutions Holiday** (`institution_name = NULL`)
   - Example: Republic Day, Independence Day
   - Applies to everyone

2. **Institution-Specific Holiday** (`institution_name = 'ABC School'`)
   - Example: School Annual Day, College Fest
   - Only applies to that institution

## Functions Available

### 1. `calculate_working_days(start_date, end_date)`
- Excludes Sundays and ALL holidays (regardless of institution)
- Used for general working days calculation
- **Use when:** You want to count working days excluding all holidays

### 2. `calculate_working_days_for_institution(start_date, end_date, institution_name)`
- Excludes Sundays and institution-specific holidays
- Only counts holidays marked for "all institutions" OR the specific institution
- **Use when:** You want institution-aware working days calculation

## Impact on Attendance Stats

After this migration:
- **Working Days** stat will show correct count (excluding Sundays + holidays)
- **Attendance Percentage** will be calculated correctly
- **Salary calculations** will use correct working days

## Example Scenarios

### Scenario 1: National Holiday
```
Date: January 26 (Republic Day)
Holiday: institution_name = NULL (all institutions)
Result: Excluded from working days for ALL employees
```

### Scenario 2: School-Specific Holiday
```
Date: March 15 (Annual Day)
Holiday: institution_name = 'ABC School'
Result: 
  - Excluded for ABC School employees
  - Counted as working day for other institutions
```

### Scenario 3: Sunday
```
Date: Any Sunday
Result: Always excluded from working days (no attendance expected)
```

## Troubleshooting

### Working days count seems wrong
1. Check if holidays are properly added in Holiday Manager
2. Verify institution names match exactly
3. Run the verification query above

### Attendance percentage is 0%
- This happens if working_days = 0
- Check if the month has any working days
- Verify holidays table has correct data

### Migration fails
- Ensure you ran the holiday institution migration first
- Check if you have admin access to Supabase
- Try running the SQL commands one by one

## Support
If you face any issues, check the browser console for detailed error messages.
