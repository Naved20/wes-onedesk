# EPF/ESIC Payslip Calculation Bug Fix

## Problem Statement

The ESIC (Employee State Insurance Contribution) calculations in payslips are incorrectly using total gross earnings (which includes performance-based variable earnings) instead of fixed earnings only. This causes inflated ESIC deductions for both employee and employer contributions.

## Current Incorrect Behavior

**Lines 1383-1400 in src/components/salary/SalaryManagement.tsx:**

```
ESIC Employee = totalGrossEarnings × (esic_employee_rate / 100)
ESIC Employer = totalGrossEarnings × (3.25 / 100)
```

Where `totalGrossEarnings = grossEarned + totalVariableEarnings`

This includes performance earnings, which should NOT be included in statutory contribution calculations.

**Impact:**
- ESIC employee deduction is inflated
- ESIC employer contribution is inflated
- Net salary payable to employee is understated
- Statutory compliance reporting is incorrect

## Required Correct Behavior

ESIC calculations should use **Fixed Earnings Only**:
- Basic earned
- HRA earned  
- Other allowances earned
- Excludes all performance-based/variable earnings

**Correct Formula:**
```
Fixed Earnings = basicEarned + hraEarned + otherAllowanceEarned

ESIC Employee = Fixed Earnings × (esic_employee_rate / 100)
ESIC Employer = Fixed Earnings × (3.25 / 100)
```

**EPF Calculation:**
- Currently CORRECT: Uses `basicEarned` only
- Should remain unchanged

## Affected Components

1. **Primary:** `src/components/salary/SalaryManagement.tsx`
   - Lines 1383-1390: ESIC Employee calculation
   - Lines 1396-1399: ESIC Employer calculation

2. **Secondary:** 
   - `src/components/salary/PayslipView.tsx` - Display logic (verify consistency)
   - `src/components/salary/PayslipGenerator.tsx` - PDF generation (verify consistency)
   - Database schema: `salaries` table columns `esic_employee`, `esic_employer`

## Acceptance Criteria

1. **AC1: ESIC Employee Deduction Calculation**
   - ESIC employee deduction uses fixed earnings only
   - Formula: `Fixed Earnings × (esic_employee_rate / 100)`
   - Excludes performance earnings from ESIC calculation

2. **AC2: ESIC Employer Contribution Calculation**
   - ESIC employer contribution uses fixed earnings only
   - Formula: `Fixed Earnings × (3.25 / 100)`
   - Excludes performance earnings from ESIC calculation

3. **AC3: EPF Calculation Unchanged**
   - EPF employee deduction remains: `basicEarned × (epf_employee_rate / 100)`
   - EPF employer contribution remains: `basicEarned × (epf_employee_rate / 100)`
   - No changes to EPF logic (already correct)

4. **AC4: Net Salary Accuracy**
   - Net payable correctly reflects adjusted ESIC deductions
   - Formula: `totalGrossEarnings - (epfEmployee + esicEmployee + otherDeductions)`

5. **AC5: Payslip Display Consistency**
   - PayslipView displays corrected ESIC values
   - PayslipGenerator PDF includes corrected ESIC values
   - All payslip displays use consistent calculation

6. **AC6: Database Consistency**
   - Salary records updated with corrected `esic_employee` values
   - Salary records updated with corrected `esic_employer` values
   - Historical data remains unaffected (fix applies prospectively)

## Success Criteria

- All ESIC calculations verified to use fixed earnings only
- EPF calculations verified unchanged
- Payslips display corrected amounts
- Net salary payable increases (due to lower ESIC deductions)
- Statutory compliance reporting reflects correct deductions
- No regression in other salary calculations (gross, basic, HRA, deductions)

## Implementation Notes

- This is a backward-incompatible change that affects calculated salary values
- Affected salary records may need recalculation (prospective fix recommended)
- Testing should verify edge cases:
  - Employees with no performance earnings
  - Employees with high performance earnings
  - ESIC-exempt scenarios
  - Partial month calculations

## Files to Modify

1. `src/components/salary/SalaryManagement.tsx` - Fix calculation logic
2. `src/components/salary/PayslipView.tsx` - Verify display consistency (if needed)
3. `src/components/salary/PayslipGenerator.tsx` - Verify PDF generation (if needed)
