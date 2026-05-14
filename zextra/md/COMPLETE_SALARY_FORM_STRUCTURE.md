# Complete Salary Form Structure - Like Payslip

## Form Structure (All Editable + Auto-Calculate)

### **Section A: Salary Structure for the Month**
*This section explains how the fixed salary is broken*

| Field | Editable | Auto-Calculated | Value |
|-------|----------|-----------------|-------|
| Fixed Gross Salary | ✅ | ❌ | ₹6,000 |
| Basic % | ✅ | ❌ | 50% |
| HRA % (of Basic) | ✅ | ❌ | 40% |
| Basic Earned | ❌ | ✅ | ₹3,000 (50% of Gross) |
| HRA Earned | ❌ | ✅ | ₹1,200 (40% of Basic) |
| Other Allowance | ❌ | ✅ | ₹1,800 (Balance) |

### **Section B: Salary Earned This Month**
*Variable earnings/incentives*

| Field | Editable | Auto-Calculated | Value |
|-------|----------|-----------------|-------|
| Fixed Gross Salary Earned | ❌ | ✅ | ₹6,000 |
| Lesson Plan Incentive | ✅ | ❌ | ₹1,000 |
| English Training Task Incentive | ✅ | ❌ | ₹500 |
| Digital Training Task Incentive | ✅ | ❌ | ₹500 |
| Other Incentive | ✅ | ❌ | ₹0 |
| **Total Gross Earnings** | ❌ | ✅ | **₹8,000** |

### **Section C: Employee Contributions / Deductions**

| Field | Editable | Auto-Calculated | Value | Remark |
|-------|----------|-----------------|-------|--------|
| EPF Eligible | ✅ (Toggle) | ❌ | Yes | - |
| EPF Wage Base | ❌ | ✅ | ₹3,000 | Basic Salary |
| Employee EPF Contribution (12%) | ❌ | ✅ | ₹360 | Deposited to PF account |
| ESIC Eligible | ✅ (Toggle) | ❌ | Yes | - |
| Employee ESIC Contribution (0.75%) | ❌ | ✅ | ₹45 | Social security |
| Manual Deduction | ✅ | ❌ | ₹0 | If applicable |
| Manual Deduction Remark | ✅ | ❌ | - | Reason |
| **Total Employee Deduction** | ❌ | ✅ | **₹405** | - |

### **Section D: Net Payable**

| Field | Auto-Calculated | Value |
|-------|-----------------|-------|
| Total Gross Earnings | ✅ | ₹8,000 |
| Less: Employee Deductions | ✅ | ₹405 |
| **Net Payable to Employee** | ✅ | **₹7,595** |

### **Section E: Statutory Benefits Paid by Employer**

| Field | Auto-Calculated | Value |
|-------|-----------------|-------|
| Employer EPF Contribution (12%) | ✅ | ₹360 |
| Employer ESIC Contribution (3.25%) | ✅ | ₹195 |
| **Total Employer Statutory Benefit** | ✅ | **₹555** |

### **Section F: Total Cost to Company**

| Field | Auto-Calculated | Value |
|-------|-----------------|-------|
| Total Gross Earnings | ✅ | ₹8,000 |
| Employer Statutory Benefit | ✅ | ₹555 |
| **Total Cost to WES** | ✅ | **₹8,555** |

---

## Form Layout Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Edit Salary Structure - Employee Name                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ A. Fixed Salary  │  │ B. Variable      │  │ Live Summary │ │
│  │    Structure     │  │    Earnings      │  │              │ │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────┤ │
│  │ • Fixed Gross    │  │ • Lesson Plan    │  │ Gross: 8000  │ │
│  │ • Basic %        │  │ • ENG Training   │  │ Deduct: 405  │ │
│  │ • HRA %          │  │ • Digital Train  │  │ Net: 7,595   │ │
│  │ • Basic (Auto)   │  │ • Other          │  │ CTC: 8,555   │ │
│  │ • HRA (Auto)     │  │                  │  │              │ │
│  │ • Other (Auto)   │  │                  │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ C. Deductions    │  │ D. Employer Cost │                    │
│  ├──────────────────┤  ├──────────────────┤                    │
│  │ • EPF Toggle     │  │ • EPF Employer   │                    │
│  │ • EPF Emp (Auto) │  │ • ESIC Employer  │                    │
│  │ • ESIC Toggle    │  │ • Total Benefit  │                    │
│  │ • ESIC Emp (Auto)│  │                  │                    │
│  │ • Manual Deduct  │  │                  │                    │
│  │ • Remark         │  │                  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ E. Bank & Statutory Details                              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • Bank Account  • PF UAN  • ESIC IP  • Effective From   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Remarks                                                   │  │
│  │ [Text area for general remarks]                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                    [Cancel]  [Save Structure]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Calculation Formulas

### Fixed Salary Breakdown:
```javascript
basicSalary = fixedGross × (basic_percentage / 100)
hraAmount = basicSalary × (hra_percentage / 100)
otherAllowance = fixedGross - basicSalary - hraAmount
```

### Variable Earnings:
```javascript
totalVariableEarnings = lessonPlan + englishTraining + digitalTraining + otherIncentive
totalGrossEarnings = fixedGross + totalVariableEarnings
```

### Employee Deductions:
```javascript
epfWageBase = basicSalary
epfEmployee = epfWageBase × 0.12 (if EPF applicable)
esicEmployee = totalGrossEarnings × 0.0075 (if ESIC applicable)
totalEmployeeDeductions = epfEmployee + esicEmployee + manualDeduction
```

### Net Payable:
```javascript
netPayable = totalGrossEarnings - totalEmployeeDeductions
```

### Employer Contributions:
```javascript
epfEmployer = epfWageBase × 0.12 (if EPF applicable)
esicEmployer = totalGrossEarnings × 0.0325 (if ESIC applicable)
totalEmployerBenefit = epfEmployer + esicEmployer
```

### Total Cost:
```javascript
totalCostToCompany = totalGrossEarnings + totalEmployerBenefit
```

---

## Implementation Status

✅ State variables updated with all fields
✅ Calculation logic implemented
✅ Props interface updated
✅ Props passed to form component

⏳ **TODO:** Update form JSX with complete structure (file too large for single replacement)

---

## Next Steps

The calculations are ready. Now need to update the form JSX to show all sections properly organized. The form should have:

1. **Top Section:** Fixed Salary Structure (editable + auto-calculated display)
2. **Middle Left:** Variable Earnings (all editable)
3. **Middle Right:** Live Summary Card
4. **Bottom Left:** Deductions (toggles + auto-calculated + manual)
5. **Bottom Right:** Employer Costs (all auto-calculated display)
6. **Footer:** Bank details, remarks, save button

All calculations are working in the background. Just need to organize the UI properly.

---

**Created:** May 15, 2026
**Status:** Calculations ready, UI update pending
