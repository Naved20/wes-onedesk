# Quick Update Guide - Salary Edit Dialog

## Problem
Current edit dialog shows simple fields. Need same structure as Salary Structure Setup tab.

## Solution
Replace the edit dialog section in `src/components/salary/SalaryManagement.tsx`

## What to Change

### 1. Add State for Earning Types
Add this near the top of the component (around line 500):

```typescript
const [earningTypes, setEarningTypes] = useState<Array<{
  earning_code: string;
  earning_name: string;
}>>([]);
```

### 2. Fetch Earning Types
Add this in `useEffect` or create new function:

```typescript
const fetchEarningTypes = async () => {
  const { data } = await supabase
    .from("earning_types")
    .select("earning_code, earning_name")
    .eq("is_active", true)
    .order("display_order");
  
  setEarningTypes(data || []);
};

useEffect(() => {
  fetchEarningTypes();
}, []);
```

### 3. Update formData Structure
Change formData to include:

```typescript
const [formData, setFormData] = useState({
  // From salary_structures
  fixed_gross_salary: 0,
  basic_percentage: 50,
  hra_percentage: 40,
  other_allowance_percentage: 30,
  
  // Attendance
  working_days: 0,
  present_days: 0,
  paid_leave_days: 0,
  
  // Variable Earnings (dynamic)
  variable_earnings: {} as Record<string, string>,
  
  // Deductions
  epf_percentage: 12,
  esic_percentage: 0.75,
  epf_applicable: true,
  esic_applicable: true,
  manual_deduction: 0,
  tds_deduction: 0,
  professional_tax: 0,
  other_deductions: 0,
  
  // Manual override
  net_salary_manual: null as number | null,
  manager_justification: "",
});
```

### 4. Update openEditDialog Function
When opening dialog, fetch salary structure:

```typescript
const openEditDialog = async (salary: SalaryRecord) => {
  setSelectedSalary(salary);
  
  // Fetch employee's salary structure
  const { data: structure } = await supabase
    .from("salary_structures")
    .select("*")
    .eq("user_id", salary.user_id)
    .eq("is_active", true)
    .maybeSingle();
  
  setFormData({
    fixed_gross_salary: structure?.fixed_gross_salary || salary.base_salary || 0,
    basic_percentage: structure?.basic_percentage || 50,
    hra_percentage: structure?.hra_percentage || 40,
    other_allowance_percentage: structure?.other_allowance_percentage || 30,
    working_days: salary.working_days || 0,
    present_days: salary.present_days || 0,
    paid_leave_days: salary.paid_leave_days || 0,
    variable_earnings: salary.variable_earnings_details || {},
    epf_percentage: structure?.epf_employee_rate || 12,
    esic_percentage: structure?.esic_employee_rate || 0.75,
    epf_applicable: structure?.epf_applicable ?? true,
    esic_applicable: structure?.esic_applicable ?? true,
    manual_deduction: 0,
    tds_deduction: salary.tds_deduction || 0,
    professional_tax: salary.professional_tax || 0,
    other_deductions: salary.other_deductions || 0,
    net_salary_manual: salary.net_salary_manual,
    manager_justification: salary.manager_justification || "",
  });
  
  setEditDialogOpen(true);
};
```

### 5. Update calculateSalary Function
Replace with:

```typescript
const calculateSalary = useCallback(() => {
  const perDayRate = formData.working_days > 0 
    ? formData.fixed_gross_salary / formData.working_days 
    : 0;
  
  const effectiveDays = formData.present_days + formData.paid_leave_days;
  const grossEarned = perDayRate * effectiveDays;
  
  // Fixed components
  const basicEarned = grossEarned * (formData.basic_percentage / 100);
  const hraEarned = basicEarned * (formData.hra_percentage / 100);
  const otherAllowanceEarned = grossEarned * (formData.other_allowance_percentage / 100);
  
  // Variable earnings
  const totalVariableEarnings = Object.values(formData.variable_earnings).reduce(
    (sum, val) => sum + (parseFloat(val as string) || 0), 0
  );
  
  // Total gross
  const totalGrossEarnings = grossEarned + totalVariableEarnings;
  
  // Deductions
  const epfEmployee = formData.epf_applicable 
    ? (basicEarned * formData.epf_percentage / 100) 
    : 0;
  const esicEmployee = formData.esic_applicable 
    ? (totalGrossEarnings * formData.esic_percentage / 100) 
    : 0;
  const totalDeductions = epfEmployee + esicEmployee + 
    formData.manual_deduction + formData.tds_deduction + 
    formData.professional_tax + formData.other_deductions;
  
  // Net payable
  const netPayable = totalGrossEarnings - totalDeductions;
  
  // Employer contributions
  const epfEmployer = formData.epf_applicable 
    ? (basicEarned * formData.epf_percentage / 100) 
    : 0;
  const esicEmployer = formData.esic_applicable 
    ? (totalGrossEarnings * 3.25 / 100) 
    : 0;
  const totalEmployerBenefit = epfEmployer + esicEmployer;
  
  // Total CTC
  const totalCTC = totalGrossEarnings + totalEmployerBenefit;
  
  return {
    perDayRate: Math.round(perDayRate * 100) / 100,
    grossEarned: Math.round(grossEarned * 100) / 100,
    basicEarned: Math.round(basicEarned * 100) / 100,
    hraEarned: Math.round(hraEarned * 100) / 100,
    otherAllowanceEarned: Math.round(otherAllowanceEarned * 100) / 100,
    totalVariableEarnings: Math.round(totalVariableEarnings * 100) / 100,
    totalGrossEarnings: Math.round(totalGrossEarnings * 100) / 100,
    epfEmployee: Math.round(epfEmployee * 100) / 100,
    esicEmployee: Math.round(esicEmployee * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPayable: Math.round(netPayable * 100) / 100,
    epfEmployer: Math.round(epfEmployer * 100) / 100,
    esicEmployer: Math.round(esicEmployer * 100) / 100,
    totalEmployerBenefit: Math.round(totalEmployerBenefit * 100) / 100,
    totalCTC: Math.round(totalCTC * 100) / 100,
  };
}, [formData]);
```

### 6. Replace Edit Dialog JSX
Find the `{/* Edit Salary Dialog */}` section and replace with the new structure from `SALARY_MANAGEMENT_UPDATE_PLAN.md`.

## Quick Test
1. Open Salary Management
2. Click edit on any salary
3. Should see:
   - Fixed Gross Salary with percentages
   - Variable Earnings (dynamic from earning_types)
   - EPF/ESIC percentages
   - Live calculation panel

## Files
- `src/components/salary/SalaryManagement.tsx` - Main file to update
- `SALARY_MANAGEMENT_UPDATE_PLAN.md` - Detailed plan with full code
