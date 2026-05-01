# Holiday Institution Migration Guide

## Overview
This migration adds institution-specific holiday support. Now holidays can be assigned to specific institutions or marked as applicable to all institutions.

## Changes Made

### Database Changes:
1. Added `institution_name` column to `holidays` table
2. Removed unique constraint on `date` (same date can have different holidays for different institutions)
3. Added composite unique constraint on `(date, institution_name)`
4. Created index for faster institution-based queries

### UI Changes:
1. Added institution selector in Holiday Manager dialog
2. Added "Institution" column in holidays table
3. Shows "All" badge for holidays applicable to all institutions
4. Shows specific institution name for institution-specific holidays

## How to Run Migration

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** from the left sidebar

### Step 2: Run the Migration
1. Click on **New Query**
2. Copy the entire content from: `supabase/migrations/20260501000000_add_institution_to_holidays.sql`
3. Paste it in the SQL editor
4. Click **Run** button

### Step 3: Verify Migration
Run this query to verify the changes:
```sql
-- Check if institution_name column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'holidays' 
AND column_name = 'institution_name';

-- Check existing holidays
SELECT id, name, date, institution_name, is_national
FROM holidays
ORDER BY date DESC;
```

## How It Works

### Adding Holidays:
1. **All Institutions**: Select "All Institutions" - holiday applies to everyone
2. **Specific Institution**: Select an institution name - holiday only applies to that institution

### Examples:
- **Republic Day** → All Institutions (National holiday)
- **School Annual Day** → Specific School (Institution-specific)
- **Diwali** → All Institutions (Common holiday)
- **College Fest** → Specific College (Institution-specific)

### Backward Compatibility:
- Existing holidays will have `institution_name = NULL`
- NULL means the holiday applies to all institutions
- No data loss - all existing holidays remain intact

## Features:
✅ Institution-specific holidays
✅ All-institution holidays
✅ Same date can have different holidays for different institutions
✅ Visual badges showing institution names
✅ Dropdown to select institution while adding holiday

## Troubleshooting

### Error: "duplicate key value violates unique constraint"
- This means a holiday already exists for that date and institution
- Either choose a different date or different institution

### Institution dropdown is empty
- Make sure institutions are created in the Institutions page
- Check `manager_institutions` table has data

### Migration fails
- Check if you have admin access to Supabase
- Ensure no other migrations are running
- Try running the SQL commands one by one

## Support
If you face any issues, check the browser console for detailed error messages.
