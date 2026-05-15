# Complete Salary System Implementation Guide

## Overview
This guide implements a complete salary management system with:
1. ✅ Salary generation from salary_structures + attendance
2. ✅ Complete breakdown (Fixed, Variable, Deductions, CTC)
3. ✅ Editable salary dialog with live calculations
4. ✅ Attendance-based calculations

## Step 1: Run Database Migrations

Run these migrations in order:

### Migration 1: Add Columns to Salaries Table
```bash
# File: supabase/migrations/20260515000007_add_complete_salary_columns.sql
```

This adds:
- `basic_earned`, `hra_earned`, `other_allowance_earned`
- `variable_earnings_details` (JSONB), `variable_earnings_total`
- `epf_employee`, `esic_employee`, `epf_employer`, `esic_employer`
- `total_deductions`, `gross_salary`, `net_salary_calculated`
- `total_employer_contribution`, `total_ctc`
- Approval fields

### Migration 2: Update Generate Function
```bash
# File: supabase/migrations/20260515000008_update_generate_with_complete_structure.sql
```

This updates `generate_monthly_salaries()` to:
- Fetch from salary_structures table
- Calculate based on attendance
- Store complete breakdown
- Calculate employer contributions and CTC

## Step 2: Test Salary Generation

### Test in Supabase SQL Editor:
```sql
-- Generate salaries for May 2026
SELECT generate_monthly_salaries(2026, 5);

-- Check generated records
SELECT 
  s.id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  s.base_salary,
  s.working_days,
  s.present_days,
  s.basic_earned,
  s.hra_earned,
  s.other_allowance_earned,
  s.gross_salary,
  s.epf_employee,
  s.esic_employee,
  s.total_deductions,
  s.net_salary_calculated,
  s.epf_employer,
  s.esic_employer,
  s.total_ctc
FROM salaries s
JOIN employee_profiles ep ON s.user_id = ep.user_id
WHERE s.month = 5 AND s.year = 2026
ORDER BY ep.first_name;
```

### Expected Output:
```
employee_name: Alisha Siddiqui
base_salary: 10000.00 (from salary_structures)
working_days: 26
present_days: 13
basic_earned: 2500.00 (50% of 5000 earned)
hra_earned: 1000.00 (40% of 2500 basic)
other_allowance_earned: 1500.00 (30% of 5000 earned)
gross_salary: 5000.00
epf_employee: 300.00 (12% of 2500)
esic_employee: 37.50 (0.75% of 5000)
total_deductions: 337.50
net_salary_calculated: 4662.50
epf_employer: 300.00 (12% of 2500)
esic_employer: 162.50 (3.25% of 5000)
total_ctc: 5462.50
```

## Step 3: Update Frontend - SalaryManagement.tsx

### 3.1: Add State for Earning Types
```typescript
const [earningTypes, setEarningTypes] = useState<Array<{
  earning_code: string;
  earning_name: string;
}>>([]);

useEffect(() => {
  const fetchEarningTypes = async () => {
    const { data } = await supabase
      .from("earning_types")
      .select("earning_code, earning_name")
      .eq("is_active", true)
      .order("display_order");
    
    setEarningTypes(data || []);
  };
  
  fetchEarningTypes();
}, []);
```

### 3.2: Update formData Structure
```typescript
const [formData, setFormData] = useState({
  // From salary_structures
  fixed_gross_salary: 0,
  basic_percentage: 50,
  hra_percentage: 40,
  other_allowance_percentage: 30,
  
  // Attendance (auto-fetched)
  working_days: 0,
  present_days: 0,
  paid_leave_days: 0,
  absent_days: 0,
  
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

### 3.3: Update openEditDialog Function
```typescript
const openEditDialog = async (salary: SalaryRecord) => {
  setSelectedSalary(salary);
  setLoading(true);
  
  try {
    // 1. Fetch employee's salary structure
    const { data: structure } = await supabase
      .from("salary_structures")
      .select("*")
      .eq("user_id", salary.user_id)
      .eq("is_active", true)
      .maybeSingle();
    
    // 2. Fetch attendance data for the month
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
    
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", salary.user_id)
      .gte("date", startDate)
      .lte("date", endDate);
    
    // 3. Calculate attendance summary
    const attendanceSummary = calculateAttendanceSummary(attendanceData || []);
    
    // 4. Set form data
    setFormData({
      fixed_gross_salary: structure?.fixed_gross_salary || salary.base_salary || 0,
      basic_percentage: structure?.basic_percentage || 50,
      hra_percentage: structure?.hra_percentage || 40,
      other_allowance_percentage: structure?.other_allowance_percentage || 30,
      
      working_days: salary.working_days || 26,
      present_days: attendanceSummary.presentDays,
      paid_leave_days: attendanceSummary.paidLeaveDays,
      absent_days: attendanceSummary.absentDays,
      
      variable_earnings: salary.variable_earnings_details || {},
      
      epf_percentage: structure?.epf_employee_rate || 12,
      esic_percentage: structure?.esic_employee_rate || 0.75,
      epf_applicable: structure?.epf_applicable ?? true,
      esic_applicable: structure?.esic_applicable ?? true,
      manual_deduction: salary.manual_deduction || 0,
      tds_deduction: salary.tds_deduction || 0,
      professional_tax: salary.professional_tax || 0,
      other_deductions: salary.other_deductions || 0,
      
      net_salary_manual: salary.net_salary_manual,
      manager_justification: salary.manager_justification || "",
    });
    
  } finally {
    setLoading(false);
    setEditDialogOpen(true);
  }
};
```

### 3.4: Add Attendance Summary Calculator
```typescript
const calculateAttendanceSummary = (attendanceRecords: any[]) => {
  let presentDays = 0;
  let paidLeaveDays = 0;
  let absentDays = 0;
  
  attendanceRecords.forEach((record) => {
    const status = record.status?.toLowerCase();
    const isHalfDay = record.is_half_day;
    
    if (status === 'approved' || status === 'present') {
      presentDays += isHalfDay ? 0.5 : 1;
    } else if (status === 'paid_leave') {
      paidLeaveDays += isHalfDay ? 0.5 : 1;
    } else if (status === 'absent' || status === 'rejected') {
      absentDays += isHalfDay ? 0.5 : 1;
    }
  });
  
  return {
    presentDays: Math.round(presentDays * 10) / 10,
    paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
    absentDays: Math.round(absentDays * 10) / 10,
  };
};
```

### 3.5: Update calculateSalary Function
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

### 3.6: Update handleSave Function
```typescript
const handleSave = async () => {
  if (!selectedSalary) return;

  setIsSubmitting(true);
  try {
    const calculated = calculateSalary();

    const updateData = {
      // From salary_structures
      base_salary: formData.fixed_gross_salary,
      
      // Attendance
      working_days: formData.working_days,
      present_days: formData.present_days,
      paid_leave_days: formData.paid_leave_days,
      absent_days: formData.absent_days,
      
      // Calculated values
      per_day_salary: calculated.perDayRate,
      
      // Fixed components
      basic_earned: calculated.basicEarned,
      hra_earned: calculated.hraEarned,
      other_allowance_earned: calculated.otherAllowanceEarned,
      
      // Variable earnings
      variable_earnings_details: formData.variable_earnings,
      variable_earnings_total: calculated.totalVariableEarnings,
      
      // Employee deductions
      epf_employee: calculated.epfEmployee,
      esic_employee: calculated.esicEmployee,
      manual_deduction: formData.manual_deduction,
      tds_deduction: formData.tds_deduction,
      professional_tax: formData.professional_tax,
      other_deductions: formData.other_deductions,
      total_deductions: calculated.totalDeductions,
      
      // Calculated totals
      gross_salary: calculated.totalGrossEarnings,
      net_salary_calculated: calculated.netPayable,
      net_salary_manual: formData.net_salary_manual,
      final_salary: formData.net_salary_manual || calculated.netPayable,
      
      // Employer contributions
      epf_employer: calculated.epfEmployer,
      esic_employer: calculated.esicEmployer,
      total_employer_contribution: calculated.totalEmployerBenefit,
      total_ctc: calculated.totalCTC,
      
      updated_at: new Date().toISOString(),
    };

    // If manager is proposing salary
    if (isManager && !isAdmin && formData.net_salary_manual) {
      updateData.manager_proposed_salary = formData.net_salary_manual;
      updateData.manager_justification = formData.manager_justification;
      updateData.approval_status = "pending_approval";
    }

    // Admin directly approves
    if (isAdmin && formData.net_salary_manual) {
      updateData.approval_status = "approved";
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("salaries")
      .update(updateData)
      .eq("id", selectedSalary.id);

    if (error) throw error;

    toast({
      title: "Success",
      description: "Salary updated successfully with complete breakdown",
    });
    setEditDialogOpen(false);
    fetchData();
  } catch (error) {
    console.error("Error updating salary:", error);
    toast({
      title: "Error",
      description: "Failed to update salary record",
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

### 3.7: Replace Edit Dialog JSX
Use the complete dialog JSX from `COMPLETE_SALARY_EDIT_WITH_ATTENDANCE.md`

## Step 4: Testing Checklist

### Test 1: Generate Salaries
1. Go to Salary Management
2. Select month and year
3. Click "Generate Salaries"
4. ✅ Should create records with complete breakdown

### Test 2: View Generated Data
1. Check table shows all columns
2. ✅ Base Salary, Working Days, Present Days
3. ✅ Gross Salary, Net Salary

### Test 3: Edit Salary
1. Click edit on any salary
2. ✅ Should show attendance summary (auto-fetched)
3. ✅ Should show fixed salary structure with percentages
4. ✅ Should show variable earnings (dynamic from earning_types)
5. ✅ Should show deductions with percentages
6. ✅ Should show live calculation panel

### Test 4: Modify and Save
1. Change any percentage
2. ✅ Live calculation updates immediately
3. Add variable earnings
4. ✅ Total updates
5. Click Save
6. ✅ Data saves correctly

### Test 5: Verify in Database
```sql
SELECT * FROM salaries WHERE month = 5 AND year = 2026 LIMIT 1;
```
✅ All columns should have correct values

## Benefits

1. ✅ **Complete Breakdown**: Fixed + Variable + Deductions + CTC
2. ✅ **Attendance-Based**: Auto-fetches and calculates from attendance
3. ✅ **Editable**: All components editable with live preview
4. ✅ **Consistent**: Same structure as Salary Structure Setup
5. ✅ **Dynamic**: Variable earnings from earning_types table
6. ✅ **Accurate**: Percentages auto-calculate amounts

## Files Summary

### Database Migrations:
1. `20260515000007_add_complete_salary_columns.sql` - Adds columns
2. `20260515000008_update_generate_with_complete_structure.sql` - Updates function

### Frontend:
1. `src/components/salary/SalaryManagement.tsx` - Update edit dialog

### Documentation:
1. `COMPLETE_SALARY_EDIT_WITH_ATTENDANCE.md` - Complete dialog JSX
2. `COMPLETE_SALARY_IMPLEMENTATION_GUIDE.md` - This file

## Next Steps

1. ✅ Run migrations in Supabase
2. ✅ Test salary generation
3. ✅ Update SalaryManagement.tsx
4. ✅ Test edit dialog
5. ✅ Verify all calculations
