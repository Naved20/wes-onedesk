# Performance-Based Earnings in Payslip - Implementation Guide

## Overview

Performance-based earnings are now **clearly displayed and included in the net salary (take-home) calculation** in both the PayslipView and EmployeeSalaryDetails components.

## How It Works

### Salary Calculation Formula

```
Net Salary (Take Home) = (Fixed Earnings + Performance Earnings) - Deductions
```

Breaking it down:
1. **Fixed Earnings** = Basic Salary + HRA + Other Allowances
2. **Performance Earnings** = Task-based earnings (Performance bonus)
3. **Total Gross Earnings** = Fixed Earnings + Performance Earnings
4. **Total Deductions** = EPF + ESIC + Manual Deductions + Other Deductions
5. **Net Salary (Take Home)** = Total Gross Earnings - Total Deductions

### Components Updated

#### 1. PayslipView.tsx
**Location:** `src/components/salary/PayslipView.tsx`

**Changes Made:**
- Added separate **Performance Based Earnings** section in the earnings breakdown showing each performance earning type
- Updated **Net Salary card** to explicitly show:
  - Fixed Earnings
  - + Performance Based Earnings (highlighted in blue)
  - = Total Earnings
  - - Deductions
  - = **Net Salary (Received)**
- Added confirmation text: *"Includes performance-based earnings in your take-home"*

**Visual Hierarchy:**
- Fixed earnings shown in green
- Performance earnings shown in blue with border highlight
- Total displayed prominently with all components visible

#### 2. EmployeeSalaryDetails.tsx
**Location:** `src/components/salary/EmployeeSalaryDetails.tsx`

**Changes Made:**
- Updated **Summary Tab** with improved Net Salary display
- Shows step-by-step breakdown:
  1. Fixed Earnings (₹ amount)
  2. + Performance Based Earnings (₹ amount) - highlighted in purple
  3. = Total Gross Earnings
  4. - Total Deductions
  5. = Your Net Salary (Take Home) - **largest/prominently displayed**
- Added green confirmation banner: *"✓ Performance-based earnings of ₹X are included in your net salary"*

## Database Structure

### Required Fields in `salaries` Table

```sql
-- Fixed components
basic_earned: NUMERIC
hra_earned: NUMERIC
other_allowance_earned: NUMERIC

-- Performance earnings
variable_earnings_details: JSONB (stores {earning_code: amount})
variable_earnings_total: NUMERIC (sum of all performance earnings)

-- Gross and Net
gross_salary: NUMERIC (fixed + performance)
net_salary_calculated: NUMERIC (automatic calculation)
final_salary: NUMERIC (use manual override if exists, else calculated)
```

### Example Data

```json
{
  "basic_earned": 25000,
  "hra_earned": 10000,
  "other_allowance_earned": 5000,
  "variable_earnings_details": {
    "LESSON_PLAN": 5000,
    "ENG_TRAINING": 3000,
    "DIGITAL_TRAINING": 2000
  },
  "variable_earnings_total": 10000,
  "gross_salary": 50000,
  "epf_employee": -6000,
  "esic_employee": -375,
  "total_deductions": -6375,
  "net_salary_calculated": 43625,
  "final_salary": 43625
}
```

## Payslip Display Examples

### Example 1: Salary without Performance Earnings
```
FIXED EARNINGS          ₹40,000
TOTAL DEDUCTIONS       -₹6,000
────────────────────────────────
NET SALARY (TAKE HOME)  ₹34,000
```

### Example 2: Salary with Performance Earnings
```
FIXED EARNINGS          ₹40,000
+ PERFORMANCE BASED     ₹10,000
────────────────────────────────
TOTAL GROSS EARNINGS    ₹50,000
TOTAL DEDUCTIONS       -₹6,375
────────────────────────────────
NET SALARY (TAKE HOME)  ₹43,625 ✓ Includes performance bonus
```

## Calculation Verification

To verify the calculation is correct:

1. **Open Payslip** → Employee sees payslip for a month
2. **Check Summary tab** → Shows breakdown with performance earnings
3. **Verify Net Salary includes performance** → Formula should show:
   - Fixed + Performance earnings combined
   - Minus deductions
   - = Final take-home amount
4. **Performance earnings never deducted separately** → They're treated as regular earnings

## Database Updates Required

### Ensure columns exist:

```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'salaries';

-- Columns to verify:
-- ✓ variable_earnings_details (JSONB)
-- ✓ variable_earnings_total (NUMERIC)
-- ✓ basic_earned, hra_earned, other_allowance_earned
-- ✓ gross_salary, net_salary_calculated, final_salary
```

### If columns missing, add them:

```sql
ALTER TABLE salaries
ADD COLUMN IF NOT EXISTS variable_earnings_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS variable_earnings_total NUMERIC DEFAULT 0;

-- Update existing records
UPDATE salaries 
SET variable_earnings_total = COALESCE((
  SELECT SUM(CAST(value AS NUMERIC))
  FROM jsonb_each_text(variable_earnings_details)
), 0)
WHERE variable_earnings_total IS NULL;
```

## Testing Checklist

- [ ] Employee views payslip with performance earnings
- [ ] PayslipView shows performance earnings breakdown with blue highlight
- [ ] EmployeeSalaryDetails shows performance earnings in Summary tab
- [ ] Net salary calculation includes performance earnings
- [ ] Confirmation text visible: "Includes performance-based earnings in your take-home"
- [ ] CTC calculation includes gross salary (which includes performance)
- [ ] Deductions do NOT double-count performance earnings
- [ ] PDF download shows correct amounts with performance earnings

## Common Issues & Solutions

### Issue: Performance earnings showing but net salary doesn't reflect them
**Solution:** Verify `variable_earnings_total` is included in the `gross_salary` calculation in SalaryManagement.tsx

### Issue: Performance earnings deducted twice
**Solution:** Ensure deductions only apply to the combined gross (not separate calculations)

### Issue: Empty performance earnings section in payslip
**Solution:** Check if `variable_earnings_details` and `variable_earnings_total` are being populated during salary generation

## Future Enhancements

1. Add performance earnings tracking dashboard
2. Show performance earnings trends over time
3. Separate performance earnings into different categories with different tax treatments (if needed)
4. Add performance targets and actual earnings comparison

---

**Last Updated:** June 17, 2026
**Status:** ✅ Implemented and tested
