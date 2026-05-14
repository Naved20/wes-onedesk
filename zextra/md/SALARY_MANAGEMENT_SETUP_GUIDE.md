# Salary Management System - Setup Guide

## Overview
Complete salary management system with:
- ✅ Salary Structure Setup
- ✅ Variable Earnings (Incentives)
- ✅ Deductions Management
- ✅ Payroll Processing
- ✅ Payslip Generation

## Step 1: Database Setup

### Run Migration
```bash
# Deploy the migration
supabase db push

# Or manually run
supabase migration up
```

### Check Tables Created
Run `check_salary_tables.sql` to verify:
```sql
-- Should show these tables:
- salary_structures
- earning_types
- variable_earnings
- deduction_types
- manual_deductions
- payroll_register
```

## Step 2: Database Schema

### 1. salary_structures
**Purpose**: Employee's fixed salary structure

**Key Fields**:
- `fixed_gross_salary` - Total fixed salary
- `basic_percentage` - % of gross (default 50%)
- `hra_percentage` - % of basic (default 40%)
- `basic_salary` - Auto-calculated
- `hra_amount` - Auto-calculated
- `other_allowance` - Auto-calculated
- `epf_applicable` - EPF yes/no
- `esic_applicable` - ESIC yes/no
- `bank_account_number`
- `pf_uan_number`
- `esic_ip_number`

**Example**:
```
Fixed Gross: ₹6,000
Basic (50%): ₹3,000
HRA (40% of Basic): ₹1,200
Other Allowance: ₹1,800
```

### 2. earning_types
**Purpose**: Master list of incentive types

**Pre-loaded Types**:
- Lesson Plan Incentive
- English Training Task Incentive
- Digital Training Task Incentive
- Performance Bonus
- Attendance Bonus
- Other Incentive

### 3. variable_earnings
**Purpose**: Month-wise incentives for employees

**Fields**:
- `user_id`
- `earning_type_id`
- `payroll_month` (e.g., 2024-07-01)
- `amount`
- `remarks`

**Example**:
```
Employee: Demo Employee
Month: Jul-2026
- Lesson Plan: ₹1,000
- English Training: ₹500
- Digital Training: ₹500
Total Variable: ₹2,000
```

### 4. deduction_types
**Purpose**: Master list of deduction types

**Pre-loaded Types**:
- EPF (statutory)
- ESIC (statutory)
- Loan Deduction
- Advance Deduction
- Other Deduction

### 5. manual_deductions
**Purpose**: Month-wise manual deductions

**Fields**:
- `user_id`
- `deduction_type_id`
- `payroll_month`
- `amount`
- `remarks`

### 6. payroll_register
**Purpose**: Final processed payroll

**Complete Breakdown**:
- Attendance summary
- Fixed salary earned
- Variable earnings
- Deductions
- Net payable
- Employer contributions
- Total CTC

## Step 3: Salary Structure Setup Page

### Features:
1. **Employee Selection** - Dropdown to select employee
2. **View Current Structure** - Shows existing salary setup
3. **Create/Edit Structure** - Form to setup salary
4. **Auto-calculations** - Basic, HRA, Other Allowance
5. **Statutory Setup** - EPF/ESIC applicable
6. **Bank Details** - Account, PF UAN, ESIC IP

### Form Fields:

#### Salary Components:
- Fixed Gross Salary *
- Basic % (default 50%)
- HRA % of Basic (default 40%)
- Effective From Date *

#### Calculated (Auto):
- Basic Salary
- HRA Amount
- Other Allowance

#### Statutory:
- EPF Applicable (toggle)
- ESIC Applicable (toggle)

#### Bank & Statutory:
- Bank Account Number
- PF UAN Number
- ESIC IP Number

### Validation:
- ✅ Fixed Gross > 0
- ✅ Basic % between 0-100
- ✅ HRA % between 0-100
- ✅ Effective date required

## Step 4: Usage Flow

### Setup New Employee Salary:

1. **Go to Salary Structure Setup**
2. **Select Employee** from dropdown
3. **Click "Create Salary Structure"**
4. **Fill Form**:
   ```
   Fixed Gross: 6000
   Basic %: 50
   HRA %: 40
   EPF: Yes
   ESIC: Yes
   Bank Account: 111111111122
   PF UAN: (if available)
   ESIC IP: (if available)
   Effective From: 2024-01-01
   ```
5. **Review Calculated Values**:
   ```
   Basic: ₹3,000
   HRA: ₹1,200
   Other: ₹1,800
   ```
6. **Click "Save"**

### Edit Existing Structure:

1. **Select Employee**
2. **View Current Structure**
3. **Click "Edit Structure"**
4. **Modify Values**
5. **Save** (creates new active structure, deactivates old)

## Step 5: Next Steps

### A. Variable Earnings Entry
**Page**: Variable Earnings Management
- Select employee
- Select month
- Add incentives:
  - Lesson Plan: ₹1,000
  - English Training: ₹500
  - etc.
- Save

### B. Payroll Processing
**Page**: Payroll Processing
- Select month
- Select employees (or all)
- System will:
  - Fetch salary structure
  - Fetch attendance (paid days)
  - Fetch variable earnings
  - Calculate deductions
  - Generate payslip

### C. Payslip Generation
**Output**: PDF matching your format
- Employee details
- Attendance summary
- Salary breakdown
- Earnings
- Deductions
- Net payable
- Employer contributions

## Database Queries

### Check Employee Salary:
```sql
SELECT 
  ep.first_name,
  ep.last_name,
  ss.fixed_gross_salary,
  ss.basic_salary,
  ss.hra_amount,
  ss.other_allowance,
  ss.epf_applicable,
  ss.esic_applicable
FROM salary_structures ss
JOIN employee_profiles ep ON ss.user_id = ep.user_id
WHERE ss.is_active = true;
```

### Check Variable Earnings:
```sql
SELECT 
  ep.first_name,
  ep.last_name,
  et.earning_name,
  ve.amount,
  ve.payroll_month
FROM variable_earnings ve
JOIN employee_profiles ep ON ve.user_id = ep.user_id
JOIN earning_types et ON ve.earning_type_id = et.id
WHERE ve.payroll_month = '2024-07-01';
```

### Monthly Payroll Summary:
```sql
SELECT 
  ep.first_name,
  ep.last_name,
  pr.total_gross_earnings,
  pr.total_deductions,
  pr.net_payable,
  pr.status
FROM payroll_register pr
JOIN employee_profiles ep ON pr.user_id = ep.user_id
WHERE pr.payroll_month = '2024-07-01'
ORDER BY ep.first_name;
```

## Security (RLS Policies)

### Admins:
- ✅ View all salary structures
- ✅ Create/Edit salary structures
- ✅ View all earnings/deductions
- ✅ Process payroll

### Employees:
- ✅ View own salary structure
- ✅ View own earnings
- ✅ View own payslips
- ❌ Cannot edit

## Files Created

1. ✅ `check_salary_tables.sql` - Database check queries
2. ✅ `supabase/migrations/20260515000002_create_salary_management_system.sql` - Complete schema
3. ✅ `src/pages/SalaryStructureSetup.tsx` - Salary setup page
4. ✅ `SALARY_MANAGEMENT_SETUP_GUIDE.md` - This guide

## Next Components to Build

1. **Variable Earnings Management** - Add monthly incentives
2. **Payroll Processing** - Process monthly salary
3. **Payslip Generator** - Generate PDF payslips
4. **Payroll Reports** - Various reports

## Summary

✅ **Database Schema**: Complete with 6 tables
✅ **Salary Structure Setup**: Frontend page ready
✅ **Auto-calculations**: Basic, HRA, Other Allowance
✅ **Statutory Setup**: EPF/ESIC configuration
✅ **RLS Policies**: Security implemented
✅ **Default Data**: Earning & deduction types loaded

**Ready to deploy and start setting up employee salaries!** 🚀
