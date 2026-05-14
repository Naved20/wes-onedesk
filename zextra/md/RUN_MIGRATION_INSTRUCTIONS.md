# 🚀 Quick Guide: Run Salary Migration

## ⚡ FASTEST METHOD: Supabase Dashboard

### Step 1: Open SQL Editor
Click this link: https://supabase.com/dashboard/project/glijytescdhdtihzlhlg/sql/new

### Step 2: Copy Migration SQL
Open the file: `supabase/migrations/20260515000003_update_salary_schema_excel_format.sql`

Copy **ALL** the SQL code (from the first line to the last line)

### Step 3: Paste and Run
1. Paste the SQL into the Supabase SQL editor
2. Click the green "Run" button (or press Ctrl+Enter)
3. Wait for success message

### Step 4: Verify Success
You should see a message like:
```
Success. No rows returned
```

This means the migration ran successfully!

---

## ✅ What This Creates

After running the migration, you'll have:

1. **New Table:** `salary_structures`
   - Stores employee salary configurations
   - Includes Basic %, HRA %, EPF/ESIC settings
   - Bank account and statutory details

2. **Updated Table:** `employee_profiles`
   - New column: `employee_id` (unique identifier like "DPS-TCH-001")
   - New column: `program`
   - New column: `engagement_type` (Full-time/Part-time/Contract)
   - New column: `employment_status` (Active/Inactive)

3. **Earning Types:** Pre-configured list
   - Lesson Plan Incentive
   - English Training Task
   - Digital Training Task
   - Travel Allowance
   - Special Bonus
   - And more...

4. **Deduction Types:** Pre-configured list
   - PF Deduction (12%)
   - ESIC Deduction (0.75%)
   - TDS
   - Professional Tax
   - Loan/Advance deductions

5. **Helper Functions:**
   - `calculate_salary_components()` - Calculates Basic, HRA, Other
   - `calculate_statutory_deductions()` - Calculates EPF, ESIC

6. **View:** `payroll_register_view`
   - Excel-format view of payroll data
   - Easy to query and export

---

## 🔄 After Migration: Regenerate Types

Once the migration is successful, run this command in your terminal:

```bash
npx supabase gen types typescript --project-id glijytescdhdtihzlhlg > src/integrations/supabase/types.ts
```

This will update your TypeScript types to include the new `salary_structures` table.

---

## 🧪 Test It Works

1. Go to your app: Salaries page
2. Click "Salary Structure Setup" tab
3. Click "Setup" button for any employee
4. Fill in the form and save
5. You should see "Success" message!

---

## ❓ Troubleshooting

### Error: "relation already exists"
This means the table was already created. You can safely ignore this error.

### Error: "permission denied"
Make sure you're logged into the correct Supabase project.

### Error: "column already exists"
Some columns might already exist. The migration uses `IF NOT EXISTS` to handle this safely.

---

## 📞 Need Help?

If you encounter any issues:
1. Check the error message in the SQL editor
2. Make sure you copied the entire migration file
3. Verify you're in the correct Supabase project (glijytescdhdtihzlhlg)

---

**Quick Link:** https://supabase.com/dashboard/project/glijytescdhdtihzlhlg/sql/new

**Migration File:** `supabase/migrations/20260515000003_update_salary_schema_excel_format.sql`
