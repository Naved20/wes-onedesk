# Salary Setup and Generation Test Guide

## Overview
This guide helps you test the complete salary setup and generation flow after the fixes.

## Prerequisites
1. Run the cleanup script first: `CLEANUP_SALARY_DATA.sql`
2. Ensure the migration `20260515000004_update_salary_generation_use_structure.sql` has been applied

## Test Steps

### Step 1: Clean Up Existing Data
```sql
-- Run CLEANUP_SALARY_DATA.sql in Supabase SQL Editor
-- This will:
-- 1. Remove duplicate active salary structures
-- 2. Delete empty salary records (base_salary = 0)
-- 3. Verify cleanup was successful
```

### Step 2: Configure Salary Structure for Test Employee

1. Go to **Salaries & Earnings** page
2. Click on **Salary Structure Setup** tab
3. Select an employee (e.g., "Employee At DPS")
4. Click **Setup** button
5. Fill in the salary structure form:
   - **Fixed Gross Salary**: ₹10,000
   - **Basic %**: 50% (auto-calculates to ₹5,000)
   - **HRA %**: 40% of Basic (auto-calculates to ₹2,000)
   - **Other Allowance %**: 30% (auto-calculates to ₹3,000)
   - **EPF %**: 12%
   - **ESIC %**: 0.75%
   - **Variable Earnings**: Add any amounts (optional)
   - **Effective From**: Select current date
6. Click **Save Salary Structure**

**Expected Result**: 
- Success message appears
- Employee status changes from "Not Configured" to "Configured"
- No duplicate key error

### Step 3: Edit Existing Salary Structure

1. Click **Setup** again on the same employee
2. Modify the **Fixed Gross Salary** to ₹12,000
3. Click **Save Salary Structure**

**Expected Result**:
- Success message appears
- Existing structure is UPDATED (not duplicated)
- No duplicate key error
- Only ONE active salary structure exists for this employee

### Step 4: Verify Salary Structure in Database

```sql
-- Check active salary structures
SELECT 
  user_id,
  fixed_gross_salary,
  basic_percentage,
  hra_percentage,
  is_active,
  created_at,
  updated_at
FROM salary_structures
WHERE user_id = (SELECT user_id FROM employee_profiles WHERE first_name = 'Employee' LIMIT 1)
ORDER BY created_at DESC;

-- Should show only ONE active structure
```

### Step 5: Generate Monthly Salaries

```sql
-- Generate salaries for May 2026
SELECT generate_monthly_salaries(5, 2026);
```

**Expected Result**:
- Function returns success message
- Salaries are generated based on salary_structures table
- base_salary column is populated with correct values
- Calculation uses attendance data (working days, present days, paid leaves)

### Step 6: Verify Generated Salaries

```sql
-- Check generated salaries
SELECT 
  s.id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.base_salary,
  s.working_days,
  s.present_days,
  s.paid_leaves,
  s.gross_salary,
  s.net_salary,
  s.month,
  s.year
FROM salaries s
JOIN employee_profiles ep ON s.user_id = ep.user_id
WHERE s.month = 5 AND s.year = 2026
ORDER BY ep.first_name;

-- All records should have base_salary > 0
-- Calculations should be based on attendance
```

### Step 7: Test Salary Management Features

1. Go to **Salary Management** tab
2. Test **Search**: Type employee name in search bar
3. Test **Sorting**: Click on column headers (Employee, Base Salary, etc.)
4. Verify all data displays correctly

## Verification Checklist

- [ ] Cleanup script removed duplicate structures
- [ ] Cleanup script deleted empty salary records
- [ ] Can create new salary structure without errors
- [ ] Can edit existing salary structure without duplicate key error
- [ ] Only ONE active structure exists per employee
- [ ] Salary generation uses salary_structures table
- [ ] Generated salaries have correct base_salary values
- [ ] Attendance data is properly used in calculations
- [ ] Search functionality works in Salary Management
- [ ] Sorting functionality works in Salary Management

## Common Issues and Solutions

### Issue 1: Duplicate Key Error
**Symptom**: Error "duplicate key value violates unique constraint unique_active_salary_per_user"
**Solution**: 
1. Run CLEANUP_SALARY_DATA.sql to remove duplicates
2. Ensure you're using the updated Salaries.tsx with the fix

### Issue 2: base_salary = 0 in Generated Salaries
**Symptom**: Salaries are generated but base_salary is 0
**Solution**:
1. Ensure salary structure is configured for the employee
2. Check that is_active = true for the salary structure
3. Verify the generate_monthly_salaries() function is using the updated version

### Issue 3: Old Empty Salary Records
**Symptom**: Multiple salary records with base_salary = 0
**Solution**: Run the DELETE statement in CLEANUP_SALARY_DATA.sql

## Database Schema Reference

### salary_structures Table
- **user_id**: Employee ID (foreign key)
- **fixed_gross_salary**: Monthly gross salary (e.g., ₹10,000)
- **basic_percentage**: Basic salary % (typically 50%)
- **hra_percentage**: HRA % of Basic (typically 40%)
- **is_active**: Only ONE active structure per user
- **effective_from**: Start date of this structure

### salaries Table
- **user_id**: Employee ID
- **month**: Salary month (1-12)
- **year**: Salary year
- **base_salary**: From salary_structures.fixed_gross_salary
- **working_days**: Total working days in month
- **present_days**: Days employee was present
- **paid_leaves**: Approved leaves
- **gross_salary**: Calculated based on attendance
- **net_salary**: After deductions

## Formula Reference

### Salary Calculation
```
Per Day Rate = Fixed Gross Salary ÷ Working Days
Effective Days = Present Days + Paid Leaves
Gross Earned = Per Day Rate × Effective Days

Basic Earned = Gross Earned × Basic %
HRA Earned = Basic Earned × HRA %
Other Allowance = Gross Earned - Basic Earned - HRA Earned

EPF Employee = Basic Earned × 12%
ESIC Employee = Gross Earned × 0.75%

Net Salary = Gross Earned - EPF - ESIC - Other Deductions
```

## Next Steps After Testing

1. Configure salary structures for all employees
2. Generate salaries for the current month
3. Review and approve generated salaries
4. Generate payslips for employees
5. Set up variable earnings (if applicable)
