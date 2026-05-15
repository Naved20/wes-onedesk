# Salary Management Edit Dialog Update Plan

## Current Issue
Screenshot shows simple edit dialog with:
- Base Salary (single field)
- Working Days, Present Days
- HRA Amount, Travel Allowance (manual amounts)
- Simple deductions

## Required Structure
Same as **Salary Structure Setup** tab:

### A. Fixed Salary Structure
- **Fixed Gross Salary** (₹10,000)
- **Basic %** (50%) → Auto-calculates Basic Amount
- **HRA %** (40% of Basic) → Auto-calculates HRA Amount  
- **Other Allowance %** (30%) → Auto-calculates Other Allowance

### B. Variable Earnings (Dynamic from earning_types)
- Lesson Plan
- ENG Training Task
- Digital Training Task
- Travel Allowance
- Special Bonus
- Performance Bonus
- Attendance Bonus
- Other Incentive

### C. Deductions
- **EPF %** (12%) → Auto-calculates from Basic
- **ESIC %** (0.75%) → Auto-calculates from Gross
- Manual Deduction
- TDS Deduction
- Professional Tax
- Other Deductions

### D. Live Calculation Panel
Same as Setup tab:
- A. Fixed Salary Structure breakdown
- B. Total Earnings (Fixed + Variable)
- C. Employee Deductions
- D. Net Payable
- E. Employer Contributions
- F. Total CTC

## Implementation Steps

### Step 1: Fetch Salary Structure
When editing salary, fetch the employee's salary_structure:
```typescript
const { data: structure } = await supabase
  .from("salary_structures")
  .select("*")
  .eq("user_id", salary.user_id)
  .eq("is_active", true)
  .single();
```

### Step 2: Fetch Earning Types
```typescript
const { data: earningTypes } = await supabase
  .from("earning_types")
  .select("*")
  .eq("is_active", true)
  .order("display_order");
```

### Step 3: Update Form Data Structure
```typescript
const [formData, setFormData] = useState({
  // Fixed Salary Structure
  fixed_gross_salary: 0,
  basic_percentage: 50,
  hra_percentage: 40,
  other_allowance_percentage: 30,
  
  // Attendance
  working_days: 0,
  present_days: 0,
  paid_leave_days: 0,
  
  // Variable Earnings (dynamic object)
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
  net_salary_manual: null,
  manager_justification: "",
});
```

### Step 4: Live Calculation Logic
```typescript
// A. Fixed Salary Breakdown
const perDayRate = fixed_gross_salary / working_days;
const effectiveDays = present_days + paid_leave_days;
const grossEarned = perDayRate * effectiveDays;

const basicEarned = grossEarned * (basic_percentage / 100);
const hraEarned = basicEarned * (hra_percentage / 100);
const otherAllowanceEarned = grossEarned * (other_allowance_percentage / 100);

// B. Variable Earnings
const totalVariableEarnings = Object.values(variable_earnings).reduce(
  (sum, val) => sum + (parseFloat(val) || 0), 0
);

// C. Total Gross
const totalGrossEarnings = grossEarned + totalVariableEarnings;

// D. Deductions
const epfEmployee = epf_applicable ? (basicEarned * epf_percentage / 100) : 0;
const esicEmployee = esic_applicable ? (totalGrossEarnings * esic_percentage / 100) : 0;
const totalDeductions = epfEmployee + esicEmployee + manual_deduction + tds_deduction + professional_tax + other_deductions;

// E. Net Payable
const netPayable = totalGrossEarnings - totalDeductions;

// F. Employer Contributions
const epfEmployer = epf_applicable ? (basicEarned * epf_percentage / 100) : 0;
const esicEmployer = esic_applicable ? (totalGrossEarnings * 3.25 / 100) : 0;
const totalEmployerBenefit = epfEmployer + esicEmployer;

// G. Total CTC
const totalCTC = totalGrossEarnings + totalEmployerBenefit;
```

### Step 5: Update Dialog UI
Replace current simple form with:

```tsx
<Tabs defaultValue="earnings">
  <TabsList>
    <TabsTrigger value="earnings">Earnings</TabsTrigger>
    <TabsTrigger value="deductions">Deductions</TabsTrigger>
  </TabsList>

  <TabsContent value="earnings">
    {/* Fixed Salary Structure */}
    <div className="space-y-4">
      <h4>Fixed Gross Salary (Monthly) *</h4>
      <Input
        type="number"
        value={formData.fixed_gross_salary}
        onChange={(e) => setFormData(p => ({ ...p, fixed_gross_salary: Number(e.target.value) }))}
      />
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Basic %</Label>
          <Input
            type="number"
            value={formData.basic_percentage}
            onChange={(e) => setFormData(p => ({ ...p, basic_percentage: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">
            Auto: {basic_percentage}% of Gross = ₹{basicEarned.toFixed(2)}
          </p>
        </div>
        
        <div>
          <Label>HRA % (of Basic)</Label>
          <Input
            type="number"
            value={formData.hra_percentage}
            onChange={(e) => setFormData(p => ({ ...p, hra_percentage: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">
            Auto: {hra_percentage}% of Basic = ₹{hraEarned.toFixed(2)}
          </p>
        </div>
        
        <div>
          <Label>Other Allowance %</Label>
          <Input
            type="number"
            value={formData.other_allowance_percentage}
            onChange={(e) => setFormData(p => ({ ...p, other_allowance_percentage: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">
            Auto: {other_allowance_percentage}% of Gross = ₹{otherAllowanceEarned.toFixed(2)}
          </p>
        </div>
      </div>
    </div>

    {/* Variable Earnings */}
    <div className="space-y-4 mt-6">
      <h4>Variable Earnings</h4>
      {earningTypes.map((earning) => (
        <div key={earning.earning_code}>
          <Label>{earning.earning_name}</Label>
          <Input
            type="number"
            value={formData.variable_earnings[earning.earning_code] || ""}
            onChange={(e) => setFormData(p => ({
              ...p,
              variable_earnings: {
                ...p.variable_earnings,
                [earning.earning_code]: e.target.value
              }
            }))}
          />
        </div>
      ))}
    </div>
  </TabsContent>

  <TabsContent value="deductions">
    {/* EPF Deduction */}
    <div>
      <Label>EPF %</Label>
      <Input
        type="number"
        value={formData.epf_percentage}
        onChange={(e) => setFormData(p => ({ ...p, epf_percentage: Number(e.target.value) }))}
      />
      <p className="text-xs text-muted-foreground">
        Employee EPF (Auto): ₹{epfEmployee.toFixed(2)} ({epf_percentage}% of Basic ₹{basicEarned.toFixed(2)})
      </p>
    </div>

    {/* ESIC Deduction */}
    <div>
      <Label>ESIC %</Label>
      <Input
        type="number"
        value={formData.esic_percentage}
        onChange={(e) => setFormData(p => ({ ...p, esic_percentage: Number(e.target.value) }))}
      />
      <p className="text-xs text-muted-foreground">
        Employee ESIC (Auto): ₹{esicEmployee.toFixed(2)} ({esic_percentage}% of Total Gross ₹{totalGrossEarnings.toFixed(2)})
      </p>
    </div>

    {/* Other Deductions */}
    <div>
      <Label>Manual Deduction</Label>
      <Input type="number" value={formData.manual_deduction} onChange={...} />
    </div>
    <div>
      <Label>TDS Deduction</Label>
      <Input type="number" value={formData.tds_deduction} onChange={...} />
    </div>
    <div>
      <Label>Professional Tax</Label>
      <Input type="number" value={formData.professional_tax} onChange={...} />
    </div>
    <div>
      <Label>Other Deductions</Label>
      <Input type="number" value={formData.other_deductions} onChange={...} />
    </div>
  </TabsContent>
</Tabs>

{/* Live Calculation Panel */}
<div className="mt-6 p-4 bg-muted rounded-lg">
  <h4 className="font-semibold mb-4">Live Calculation</h4>
  
  <div className="space-y-2">
    <div className="flex justify-between">
      <span>A. Fixed Salary Structure</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>Fixed Gross Salary</span>
      <span>₹{fixed_gross_salary.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>Basic ({basic_percentage}%)</span>
      <span>₹{basicEarned.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>HRA ({hra_percentage}% of Basic)</span>
      <span>₹{hraEarned.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>Other Allowance ({other_allowance_percentage}%)</span>
      <span>₹{otherAllowanceEarned.toFixed(2)}</span>
    </div>
    
    <div className="flex justify-between font-semibold border-t pt-2">
      <span>B. Total Earnings</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>Fixed Gross</span>
      <span>₹{grossEarned.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>Variable Earnings</span>
      <span>₹{totalVariableEarnings.toFixed(2)}</span>
    </div>
    <div className="flex justify-between font-semibold pl-4">
      <span>Total Gross Earnings</span>
      <span>₹{totalGrossEarnings.toFixed(2)}</span>
    </div>
    
    <div className="flex justify-between font-semibold border-t pt-2">
      <span>C. Employee Deductions</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>EPF Employee</span>
      <span>₹{epfEmployee.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>ESIC Employee</span>
      <span>₹{esicEmployee.toFixed(2)}</span>
    </div>
    <div className="flex justify-between font-semibold pl-4">
      <span>Total Deductions</span>
      <span className="text-destructive">₹{totalDeductions.toFixed(2)}</span>
    </div>
    
    <div className="flex justify-between font-bold text-lg border-t pt-2 text-green-600">
      <span>D. Net Payable to Employee</span>
      <span>₹{netPayable.toFixed(2)}</span>
    </div>
    
    <div className="flex justify-between font-semibold border-t pt-2">
      <span>E. Employer Contributions</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>EPF Employer ({epf_percentage}%)</span>
      <span>₹{epfEmployer.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-sm pl-4">
      <span>ESIC Employer (3.25%)</span>
      <span>₹{esicEmployer.toFixed(2)}</span>
    </div>
    <div className="flex justify-between font-semibold pl-4">
      <span>Total Employer Benefit</span>
      <span>₹{totalEmployerBenefit.toFixed(2)}</span>
    </div>
    
    <div className="flex justify-between font-bold text-xl border-t pt-2 text-primary">
      <span>F. Total Cost to Company</span>
      <span>₹{totalCTC.toFixed(2)}</span>
    </div>
  </div>
</div>
```

### Step 6: Save Logic
When saving, store:
- Fixed salary components (basic_earned, hra_earned, other_allowance_earned)
- Variable earnings (as JSONB)
- Deductions (epf_employee, esic_employee, etc.)
- Calculated values (gross_salary, net_salary_calculated, final_salary)

```typescript
const handleSave = async () => {
  const calculated = calculateSalary();
  
  const updateData = {
    // From salary_structures
    base_salary: formData.fixed_gross_salary,
    
    // Attendance
    working_days: formData.working_days,
    present_days: formData.present_days,
    paid_leave_days: formData.paid_leave_days,
    
    // Calculated components
    per_day_salary: calculated.perDayRate,
    basic_earned: calculated.basicEarned,
    hra_earned: calculated.hraEarned,
    other_allowance_earned: calculated.otherAllowanceEarned,
    
    // Variable earnings
    variable_earnings_details: formData.variable_earnings,
    variable_earnings_total: calculated.totalVariableEarnings,
    
    // Deductions
    pf_deduction: calculated.epfEmployee,
    esic_deduction: calculated.esicEmployee,
    tds_deduction: formData.tds_deduction,
    professional_tax: formData.professional_tax,
    other_deductions: formData.other_deductions,
    
    // Totals
    gross_salary: calculated.totalGrossEarnings,
    net_salary_calculated: calculated.netPayable,
    net_salary_manual: formData.net_salary_manual,
    final_salary: formData.net_salary_manual || calculated.netPayable,
    
    // Employer contributions
    epf_employer: calculated.epfEmployer,
    esic_employer: calculated.esicEmployer,
    total_ctc: calculated.totalCTC,
  };
  
  await supabase
    .from("salaries")
    .update(updateData)
    .eq("id", selectedSalary.id);
};
```

## Benefits

1. ✅ **Consistent Structure**: Same as Salary Structure Setup
2. ✅ **Accurate Calculations**: Based on salary_structures table
3. ✅ **Dynamic Earnings**: Fetches from earning_types
4. ✅ **Live Preview**: Shows all calculations in real-time
5. ✅ **Percentage-based**: Editable percentages with auto-calculation
6. ✅ **Complete Breakdown**: Shows Fixed, Variable, Deductions, Net, CTC

## Files to Update

1. `src/components/salary/SalaryManagement.tsx` - Update edit dialog
2. Database schema already supports this (variable_earnings_details JSONB column exists)

## Next Steps

1. Update SalaryManagement.tsx with new dialog structure
2. Test with existing salary records
3. Verify calculations match Setup tab
4. Ensure data saves correctly to database
