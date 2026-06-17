# EPF/ESIC Bugfix Design Specification

## 1. System Architecture

### Current Salary Calculation Flow

```
┌─────────────────────────────────────────┐
│ Salary Record (Attendance Data)         │
│ - Working days, present, absent, etc.   │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ calculateSalaries() in SalaryManagement  │
│ - Iterates through salary records       │
│ - Computes per-day rate                 │
└────────────────────┬────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   ┌─────────────┐        ┌──────────────────┐
   │ Gross       │        │ Variable         │
   │ Earnings    │        │ Earnings Total   │
   │ Calculation │        │ (Performance)    │
   └────┬────────┘        └────────┬─────────┘
        │                          │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Total Gross Earnings         │
        │ (Fixed + Variable)           │
        └──────────────┬───────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
    ┌────────────────┐        ┌──────────────────┐
    │ EPF Calc       │        │ ESIC Calc [BUG]  │
    │ (basicEarned)  │        │ (totalGrossEarned)
    │ ✓ Correct      │        │ ✗ Wrong - includes
    └────────────────┘        │   variable earnings
                              └──────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Total Deductions             │
        │ (EPF + ESIC + Other)         │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Net Salary (Understated)     │
        │ Due to inflated ESIC         │
        └──────────────────────────────┘
```

### Corrected Calculation Flow

The fix introduces **Fixed Earnings** as a distinct calculation point:

```
Fixed Earnings = basicEarned + hraEarned + otherAllowanceEarned

ESIC Employee = Fixed Earnings × (esic_employee_rate / 100)
ESIC Employer = Fixed Earnings × (3.25 / 100)
EPF Employee/Employer = basicEarned × (epf_employee_rate / 100)  [Unchanged]
```

### Data Flow Through Components

```
SalaryManagement.tsx (Primary Calculation)
  └─ calculateSalaries()
     ├─ Computes fixed earnings
     ├─ Calculates ESIC on fixed earnings [FIXED]
     ├─ Updates salaries table in DB
     └─ Updates salary records with corrected values
        │
        ├─> PayslipView.tsx (Display)
        │   └─ Reads from DB and displays ESIC
        │
        ├─> PayslipGenerator.tsx (PDF Export)
        │   └─ Generates PDF with ESIC values
        │
        └─> Payroll Reports
            └─ Uses updated ESIC for compliance
```

## 2. Code Changes Required

### 2.1 Primary Change: SalaryManagement.tsx

**Location:** Lines 1383-1399 in `calculateSalaries()` function

**Current Code (Buggy):**
```typescript
// Lines 1383-1390: ESIC Employee (WRONG - uses totalGrossEarnings)
const esicEmployee = ((structure as any)?.esic_applicable ?? true) 
  ? (totalGrossEarnings * ((structure as any)?.esic_employee_rate || 0.75) / 100) 
  : 0;

// Lines 1396-1399: ESIC Employer (WRONG - uses totalGrossEarnings)
const esicEmployer = ((structure as any)?.esic_applicable ?? true) 
  ? (totalGrossEarnings * 3.25 / 100) 
  : 0;
```

**Corrected Code:**
```typescript
// Calculate fixed earnings (baseline for statutory contributions)
const fixedEarnings = basicEarned + hraEarned + otherAllowanceEarned;

// Lines 1383-1390: ESIC Employee (CORRECT - uses fixedEarnings)
const esicEmployee = ((structure as any)?.esic_applicable ?? true) 
  ? (fixedEarnings * ((structure as any)?.esic_employee_rate || 0.75) / 100) 
  : 0;

// Lines 1396-1399: ESIC Employer (CORRECT - uses fixedEarnings)
const esicEmployer = ((structure as any)?.esic_applicable ?? true) 
  ? (fixedEarnings * 3.25 / 100) 
  : 0;
```

### 2.2 Calculation Logic - Detailed Pseudocode

```
FUNCTION calculateSalaries(month, year, salaryRecords, salaryStructure):
  FOR EACH salary IN salaryRecords:
    
    // Step 1: Calculate paid day units
    paidDayUnits = presentDays 
                 + holidayCount 
                 + (halfDays × 0.5) 
                 + paidLeaveDays 
                 - lateSets 
                 - absentDays
    
    // Step 2: Calculate gross earned (fixed components only)
    perDayRate = (salaryStructure.ctc / 30)
    grossEarned = paidDayUnits × perDayRate
    basicEarned = grossEarned × (basicPercentage / 100)
    hraEarned = basicEarned × (hraPercentage / 100)
    otherAllowanceEarned = grossEarned × (otherAllowancePercentage / 100)
    
    // Step 3: Calculate fixed earnings (NEW - for ESIC basis)
    fixedEarnings = basicEarned + hraEarned + otherAllowanceEarned
    
    // Step 4: Add variable earnings (NOT included in ESIC)
    totalVariableEarnings = SUM(variable_earnings_details.*)
    
    // Step 5: Calculate total gross (for net salary purposes)
    totalGrossEarnings = fixedEarnings + totalVariableEarnings
    
    // Step 6: Calculate EPF (unchanged - uses basicEarned only)
    IF salaryStructure.epf_applicable THEN
      epfEmployee = basicEarned × (epf_employee_rate / 100)
      epfEmployer = basicEarned × (epf_employee_rate / 100)
    ELSE
      epfEmployee = 0
      epfEmployer = 0
    END IF
    
    // Step 7: Calculate ESIC (FIXED - uses fixedEarnings)
    IF salaryStructure.esic_applicable THEN
      esicEmployee = fixedEarnings × (esic_employee_rate / 100)
      esicEmployer = fixedEarnings × (3.25 / 100)
    ELSE
      esicEmployee = 0
      esicEmployer = 0
    END IF
    
    // Step 8: Calculate total deductions
    totalDeductions = epfEmployee 
                    + esicEmployee 
                    + manualDeduction 
                    + tdsDeduction 
                    + professionalTax 
                    + otherDeductions
    
    // Step 9: Calculate net salary (uses totalGrossEarnings)
    netPayable = totalGrossEarnings - totalDeductions
    
    // Step 10: Calculate employer benefits
    totalEmployerBenefit = epfEmployer + esicEmployer
    
    // Step 11: Calculate CTC (Cost to Company)
    totalCTC = netPayable + totalEmployerBenefit
    
    // Step 12: Update database
    UPDATE salaries SET
      basic_earned = basicEarned,
      hra_earned = hraEarned,
      other_allowance_earned = otherAllowanceEarned,
      fixed_earnings = fixedEarnings,  // NEW: Track fixed earnings
      variable_earnings_total = totalVariableEarnings,
      gross_salary = totalGrossEarnings,
      epf_employee = epfEmployee,
      esic_employee = esicEmployee,  // Now correctly calculated
      total_deductions = totalDeductions,
      net_salary_calculated = netPayable,
      final_salary = netPayable,
      epf_employer = epfEmployer,
      esic_employer = esicEmployer,  // Now correctly calculated
      total_employer_contribution = totalEmployerBenefit,
      total_ctc = totalCTC
    WHERE id = salary.id
    
  END FOR
END FUNCTION
```

## 3. Affected Flows

### 3.1 Payroll Generation Flow
