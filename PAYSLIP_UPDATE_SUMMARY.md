# Payslip Update - New Formula & Attendance Details

## Overview
Payslip को update किया गया है new calculation formula के according और attendance details दिखाने के लिए salary table से।

---

## Changes Made

### 1. **SalaryDetail Interface Updated**
```typescript
// Added new attendance fields:
half_days: number;
sick_leaves: number;
late_days: number;
holiday_count: number;
```

### 2. **Attendance Section Updated**
**Before:** Only 4 attendance fields
**After:** All 8 attendance fields with new formula

**New Attendance Display:**
```
First Row:
- Payroll Days (Total days in month)
- Present (PR)
- Half Day (HD)
- Holiday (HO)

Second Row:
- Paid Leave (PL)
- Absent (AB)
- Late Days (LT)
- Sick Leave (LE)
```

**Formula Display:**
```
Total Paid Days Calculation: X.X days
Formula: PR (X) + HO (X) + HD (X.X) + PL (X) - Late Sets (X) - 2×AB (X) - LE (X)
```

### 3. **Earnings Section Updated - NEW FORMULA**

**Old Formula:**
```
Per Day Rate = Fixed Gross Salary ÷ Working Days
Gross Earned = Per Day Rate × (Present Days + Paid Leave Days)
```

**New Formula:**
```
Per Day Rate = Fixed Gross Salary ÷ Payroll Days (Total days in month)
Gross Earned = Per Day Rate × Total Paid Days
```

**Where:**
```
Total Paid Days = PR + HO + (HD × 0.5) + PL - Late Sets - (AB × 2) - LE
Late Sets = Math.floor(Late Days ÷ 3)
```

### 4. **Per Day Rate Calculation Updated**
```typescript
// Old:
const perDayRate = salary.working_days > 0 ? salary.base_salary / salary.working_days : 0;

// New:
const payrollDays = new Date(selectedYear, selectedMonth, 0).getDate();
const perDayRate = payrollDays > 0 ? salary.base_salary / payrollDays : 0;
```

---

## New Payslip Sections

### 1. **Attendance Details Section**
```
Attendance Details (From Salary Table)

[Payroll Days] [Present (PR)] [Half Day (HD)] [Holiday (HO)]
[Paid Leave (PL)] [Absent (AB)] [Late Days (LT)] [Sick Leave (LE)]

Total Paid Days Calculation: X.X days
Formula: PR (X) + HO (X) + HD (X.X) + PL (X) - Late Sets (X) - 2×AB (X) - LE (X)
```

### 2. **Earnings Section with New Formula**
```
Fixed Salary Structure (NEW FORMULA)

Fixed Gross Salary (Monthly): ₹X
Payroll Days (Total days in month): X days
Per Day Rate (₹X ÷ X days): ₹X.XX
Total Paid Days (from attendance calculation): X.X days
Gross Earned (Per Day Rate × Total Paid Days): ₹X

NEW FORMULA:
Per Day Rate = Fixed Gross Salary ÷ Payroll Days (Total days in month)
Gross Earned = Per Day Rate × Total Paid Days
```

---

## Data Source

**All attendance data comes from `salaries` table:**
- `present_days`
- `half_days`
- `holiday_count`
- `paid_leave_days`
- `absent_days`
- `late_days`
- `sick_leaves`

**NOT from `attendance` table** - This preserves original attendance records.

---

## Formula Details

### Total Paid Days Formula:
```
Total Paid Days = 
  PR (Present Days) +
  HO (Holiday Count) +
  (HD × 0.5) (Half Days × 0.5) +
  PL (Paid Leave Days) -
  Late Sets (Math.floor(Late Days ÷ 3)) -
  (AB × 2) (Absent Days × 2) -
  LE (Sick Leaves)
```

### Salary Calculation Formula:
```
1. Payroll Days = Total days in month (e.g., 31 for May)
2. Per Day Rate = Fixed Gross Salary ÷ Payroll Days
3. Gross Earned = Per Day Rate × Total Paid Days
```

---

## Example Calculation

**Input:**
- Fixed Gross Salary: ₹31,000
- Month: May (31 days)
- Present Days: 17
- Holiday Count: 4
- Half Days: 0
- Paid Leave Days: 0
- Absent Days: 6
- Late Days: 0
- Sick Leaves: 0

**Calculation:**
```
1. Payroll Days = 31
2. Per Day Rate = ₹31,000 ÷ 31 = ₹1,000
3. Total Paid Days = 17 + 4 + (0 × 0.5) + 0 - 0 - (6 × 2) - 0 = 15
4. Gross Earned = ₹1,000 × 15 = ₹15,000
```

---

## Visual Indicators

### Color Coding:
- **Blue**: Payroll Days, Paid Leave
- **Green**: Present Days
- **Orange**: Half Days
- **Purple**: Holiday Count
- **Red**: Absent Days
- **Yellow**: Late Days
- **Pink**: Sick Leaves

### Formula Indicators:
- Yellow background for NEW FORMULA section
- Clear formula display with calculations
- Step-by-step breakdown

---

## Benefits

✅ **Complete Attendance Details** - All 8 attendance fields displayed
✅ **New Formula Implementation** - Updated calculation logic
✅ **Clear Formula Display** - Shows calculation steps
✅ **Data Source Clarity** - Shows data comes from salaries table
✅ **Visual Indicators** - Color coding for easy understanding
✅ **Formula Breakdown** - Step-by-step calculation shown

---

## Files Modified

1. **src/components/salary/PayslipView.tsx**
   - Updated SalaryDetail interface
   - Updated attendance section
   - Updated earnings section with new formula
   - Updated perDayRate calculation
   - Added formula indicators

---

## Summary

| Aspect | Old | New |
|--------|-----|-----|
| **Attendance Fields** | 4 fields | 8 fields |
| **Per Day Rate** | ÷ Working Days | ÷ Payroll Days |
| **Total Paid Days** | PR + PL | PR + HO + (HD×0.5) + PL - Late Sets - (AB×2) - LE |
| **Data Source** | Mixed | Salaries table only |
| **Formula Display** | Not shown | Detailed breakdown |

अब payslip में complete attendance details दिखती हैं और new formula के according calculation होता है! 🎉

