# Complete Salary Edit Dialog with Attendance Integration

## Features
1. ✅ Fixed Salary Structure (with percentages)
2. ✅ Variable Earnings (dynamic from earning_types)
3. ✅ Deductions (auto-calculate with percentages)
4. ✅ Live Calculation (complete breakdown)
5. ✅ **Attendance Auto-Fetch** (Working Days, Present, Paid Leaves)

## Implementation

### Step 1: Update openEditDialog to Fetch Attendance

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
    
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", salary.user_id)
      .gte("date", startDate)
      .lte("date", endDate);
    
    if (attendanceError) throw attendanceError;
    
    // 3. Calculate attendance summary
    const attendanceSummary = calculateAttendanceSummary(attendanceData || []);
    
    // 4. Get working days for the month
    const { data: workingDaysData } = await supabase.rpc("get_working_days_in_month", {
      p_year: selectedYear,
      p_month: selectedMonth,
    });
    
    const workingDays = workingDaysData || salary.working_days || 26;
    
    // 5. Set form data with all values
    setFormData({
      // From salary_structures
      fixed_gross_salary: structure?.fixed_gross_salary || salary.base_salary || 0,
      basic_percentage: structure?.basic_percentage || 50,
      hra_percentage: structure?.hra_percentage || 40,
      other_allowance_percentage: structure?.other_allowance_percentage || 30,
      
      // Attendance (auto-calculated)
      working_days: workingDays,
      present_days: attendanceSummary.presentDays,
      paid_leave_days: attendanceSummary.paidLeaveDays,
      absent_days: attendanceSummary.absentDays,
      
      // Variable earnings (from existing salary record)
      variable_earnings: salary.variable_earnings_details || {},
      
      // Deductions
      epf_percentage: structure?.epf_employee_rate || 12,
      esic_percentage: structure?.esic_employee_rate || 0.75,
      epf_applicable: structure?.epf_applicable ?? true,
      esic_applicable: structure?.esic_applicable ?? true,
      manual_deduction: 0,
      tds_deduction: salary.tds_deduction || 0,
      professional_tax: salary.professional_tax || 0,
      other_deductions: salary.other_deductions || 0,
      
      // Manual override
      net_salary_manual: salary.net_salary_manual,
      manager_justification: salary.manager_justification || "",
    });
    
  } catch (error) {
    console.error("Error loading salary data:", error);
    toast({
      title: "Error",
      description: "Failed to load salary data",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
    setEditDialogOpen(true);
  }
};
```

### Step 2: Add Attendance Summary Calculator

```typescript
const calculateAttendanceSummary = (attendanceRecords: any[]) => {
  let presentDays = 0;
  let paidLeaveDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  
  attendanceRecords.forEach((record) => {
    const status = record.status?.toLowerCase();
    const isHalfDay = record.is_half_day;
    
    if (status === 'approved' || status === 'present') {
      if (isHalfDay) {
        presentDays += 0.5;
        halfDays += 1;
      } else {
        presentDays += 1;
      }
    } else if (status === 'paid_leave') {
      if (isHalfDay) {
        paidLeaveDays += 0.5;
        halfDays += 1;
      } else {
        paidLeaveDays += 1;
      }
    } else if (status === 'absent' || status === 'rejected') {
      if (isHalfDay) {
        absentDays += 0.5;
        halfDays += 1;
      } else {
        absentDays += 1;
      }
    }
  });
  
  return {
    presentDays: Math.round(presentDays * 10) / 10,
    paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
    absentDays: Math.round(absentDays * 10) / 10,
    halfDays,
    totalPaidDays: Math.round((presentDays + paidLeaveDays) * 10) / 10,
  };
};
```

### Step 3: Update Form Data Structure

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

### Step 4: Complete Edit Dialog JSX

```tsx
<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Calculator className="h-5 w-5" />
        Edit Salary - {selectedSalary?.employee_name}
      </DialogTitle>
      <DialogDescription>
        {months.find(m => m.value === selectedMonth)?.label} {selectedYear} | 
        Attendance-based calculation
      </DialogDescription>
    </DialogHeader>

    <Tabs defaultValue="earnings" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="earnings">Earnings</TabsTrigger>
        <TabsTrigger value="deductions">Deductions</TabsTrigger>
      </TabsList>

      <TabsContent value="earnings" className="space-y-6">
        {/* Attendance Summary (Read-only display) */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Attendance Summary (Auto-fetched)
          </h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Working Days</Label>
              <p className="font-semibold text-lg">{formData.working_days}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Present Days</Label>
              <p className="font-semibold text-lg text-green-600">{formData.present_days}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Paid Leaves</Label>
              <p className="font-semibold text-lg text-blue-600">{formData.paid_leave_days}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Absent Days</Label>
              <p className="font-semibold text-lg text-red-600">{formData.absent_days}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Paid Days:</span>
              <span className="text-lg font-bold text-primary">
                {formData.present_days + formData.paid_leave_days} days
              </span>
            </div>
          </div>
        </div>

        {/* Fixed Salary Structure */}
        <div className="space-y-4">
          <h4 className="font-semibold border-b pb-2">Fixed Gross Salary (Monthly) *</h4>
          <div>
            <Label>Fixed Gross Salary</Label>
            <Input
              type="number"
              value={formData.fixed_gross_salary}
              onChange={(e) => setFormData(p => ({ ...p, fixed_gross_salary: Number(e.target.value) }))}
              className="text-lg font-semibold"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Basic %</Label>
              <Input
                type="number"
                value={formData.basic_percentage}
                onChange={(e) => setFormData(p => ({ ...p, basic_percentage: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto: {formData.basic_percentage}% of Gross = ₹{calculated.basicEarned.toFixed(2)}
              </p>
            </div>
            
            <div>
              <Label>HRA % (of Basic)</Label>
              <Input
                type="number"
                value={formData.hra_percentage}
                onChange={(e) => setFormData(p => ({ ...p, hra_percentage: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto: {formData.hra_percentage}% of Basic = ₹{calculated.hraEarned.toFixed(2)}
              </p>
            </div>
            
            <div>
              <Label>Other Allowance %</Label>
              <Input
                type="number"
                value={formData.other_allowance_percentage}
                onChange={(e) => setFormData(p => ({ ...p, other_allowance_percentage: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto: {formData.other_allowance_percentage}% of Gross = ₹{calculated.otherAllowanceEarned.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Variable Earnings */}
        <div className="space-y-4">
          <h4 className="font-semibold border-b pb-2">Variable Earnings</h4>
          <div className="grid grid-cols-2 gap-4">
            {earningTypes.map((earning) => (
              <div key={earning.earning_code}>
                <Label>{earning.earning_name}</Label>
                <Input
                  type="number"
                  placeholder="0"
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
        </div>
      </TabsContent>

      <TabsContent value="deductions" className="space-y-6">
        {/* EPF Deduction */}
        <div className="space-y-4">
          <h4 className="font-semibold border-b pb-2">EPF Deduction</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>EPF %</Label>
              <Input
                type="number"
                value={formData.epf_percentage}
                onChange={(e) => setFormData(p => ({ ...p, epf_percentage: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <Label>Employee EPF (Auto)</Label>
                <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center font-semibold">
                  ₹{calculated.epfEmployee.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.epf_percentage}% of Basic (₹{calculated.basicEarned.toFixed(2)})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ESIC Deduction */}
        <div className="space-y-4">
          <h4 className="font-semibold border-b pb-2">ESIC Deduction</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ESIC %</Label>
              <Input
                type="number"
                value={formData.esic_percentage}
                onChange={(e) => setFormData(p => ({ ...p, esic_percentage: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <Label>Employee ESIC (Auto)</Label>
                <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center font-semibold">
                  ₹{calculated.esicEmployee.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.esic_percentage}% of Total Gross (₹{calculated.totalGrossEarnings.toFixed(2)})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Deductions */}
        <div className="space-y-4">
          <h4 className="font-semibold border-b pb-2">Manual Deductions</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Manual Deduction</Label>
              <Input
                type="number"
                value={formData.manual_deduction}
                onChange={(e) => setFormData(p => ({ ...p, manual_deduction: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>TDS Deduction</Label>
              <Input
                type="number"
                value={formData.tds_deduction}
                onChange={(e) => setFormData(p => ({ ...p, tds_deduction: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Professional Tax</Label>
              <Input
                type="number"
                value={formData.professional_tax}
                onChange={(e) => setFormData(p => ({ ...p, professional_tax: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Other Deductions</Label>
              <Input
                type="number"
                value={formData.other_deductions}
                onChange={(e) => setFormData(p => ({ ...p, other_deductions: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    {/* Live Calculation Panel */}
    <div className="mt-6 p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg border-2 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h4 className="font-bold text-lg">Live Calculation</h4>
      </div>
      
      <div className="space-y-3">
        {/* A. Fixed Salary Structure */}
        <div className="space-y-2">
          <div className="flex justify-between font-semibold text-base border-b pb-2">
            <span>A. Fixed Salary Structure</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>Fixed Gross Salary</span>
            <span className="font-medium">₹{formData.fixed_gross_salary.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>Basic ({formData.basic_percentage}%)</span>
            <span className="font-medium">₹{calculated.basicEarned.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>HRA ({formData.hra_percentage}% of Basic)</span>
            <span className="font-medium">₹{calculated.hraEarned.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>Other Allowance ({formData.other_allowance_percentage}%)</span>
            <span className="font-medium">₹{calculated.otherAllowanceEarned.toLocaleString()}</span>
          </div>
        </div>

        {/* B. Total Earnings */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between font-semibold text-base border-b pb-2">
            <span>B. Total Earnings</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>Fixed Gross (Earned based on attendance)</span>
            <span className="font-medium">₹{calculated.grossEarned.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>Variable Earnings</span>
            <span className="font-medium">₹{calculated.totalVariableEarnings.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold pl-4 text-base">
            <span>Total Gross Earnings</span>
            <span className="text-primary">₹{calculated.totalGrossEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* C. Employee Deductions */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between font-semibold text-base border-b pb-2">
            <span>C. Employee Deductions</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>EPF Employee</span>
            <span className="font-medium">₹{calculated.epfEmployee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>ESIC Employee</span>
            <span className="font-medium">₹{calculated.esicEmployee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold pl-4 text-base">
            <span>Total Deductions</span>
            <span className="text-destructive">₹{calculated.totalDeductions.toLocaleString()}</span>
          </div>
        </div>

        {/* D. Net Payable */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between font-bold text-xl border-t-2 pt-3 text-green-600">
            <span>D. Net Payable to Employee</span>
            <span>₹{calculated.netPayable.toLocaleString()}</span>
          </div>
        </div>

        {/* E. Employer Contributions */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between font-semibold text-base border-b pb-2">
            <span>E. Employer Contributions</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>EPF Employer ({formData.epf_percentage}%)</span>
            <span className="font-medium">₹{calculated.epfEmployer.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm pl-4">
            <span>ESIC Employer (3.25%)</span>
            <span className="font-medium">₹{calculated.esicEmployer.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold pl-4 text-base">
            <span>Total Employer Benefit</span>
            <span>₹{calculated.totalEmployerBenefit.toLocaleString()}</span>
          </div>
        </div>

        {/* F. Total CTC */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between font-bold text-2xl border-t-2 pt-3 text-primary">
            <span>F. Total Cost to Company</span>
            <span>₹{calculated.totalCTC.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Gross Earnings + Employer Benefits
          </p>
        </div>
      </div>
    </div>

    {/* Manual Override Section */}
    <div className="border-t pt-4 space-y-4">
      <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950">
        <Label className="text-base font-semibold">Direct Net Salary Override (Optional)</Label>
        <p className="text-xs text-muted-foreground mb-3">
          {isAdmin 
            ? "Override the calculated net salary if needed (will auto-approve)"
            : "Propose a different net salary (requires admin approval)"}
        </p>
        <Input
          type="number"
          className="text-lg font-semibold"
          placeholder="Leave empty to use calculated value"
          value={formData.net_salary_manual || ""}
          onChange={(e) => setFormData(p => ({ ...p, net_salary_manual: e.target.value ? Number(e.target.value) : null }))}
        />
        {formData.net_salary_manual && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm">Difference from Calculated:</span>
              <span className={`font-semibold ${
                formData.net_salary_manual > calculated.netPayable 
                  ? "text-green-600" 
                  : formData.net_salary_manual < calculated.netPayable
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}>
                {formData.net_salary_manual > calculated.netPayable ? "+" : ""}
                ₹{(formData.net_salary_manual - calculated.netPayable).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {isManager && !isAdmin && formData.net_salary_manual && (
        <div>
          <Label>Justification (Required)</Label>
          <Textarea
            placeholder="Explain why you're proposing this salary amount..."
            value={formData.manager_justification}
            onChange={(e) => setFormData(p => ({ ...p, manager_justification: e.target.value }))}
            rows={3}
          />
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : 
          isAdmin && formData.net_salary_manual ? "Save & Approve" :
          isManager && !isAdmin && formData.net_salary_manual ? "Submit for Approval" : 
          "Save Changes"
        }
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Key Features

### 1. Attendance Auto-Fetch ✅
- Automatically fetches attendance records for the month
- Calculates: Present Days, Paid Leaves, Absent Days
- Shows summary at top of dialog
- Read-only display (can't manually edit)

### 2. Attendance-Based Calculation ✅
```
Per Day Rate = Fixed Gross Salary ÷ Working Days
Effective Days = Present Days + Paid Leaves
Gross Earned = Per Day Rate × Effective Days
```

### 3. Fixed Salary Structure ✅
- Editable percentages (Basic %, HRA %, Other Allowance %)
- Auto-calculates amounts based on attendance
- Shows both percentage and calculated amount

### 4. Variable Earnings ✅
- Dynamic from earning_types table
- Each earning type has separate input field
- Adds to total gross earnings

### 5. Deductions ✅
- EPF % and ESIC % editable
- Auto-calculates based on Basic and Gross
- Shows calculation formula
- Manual deductions also supported

### 6. Live Calculation ✅
- Complete breakdown (A to F)
- Updates in real-time as you edit
- Shows Net Payable and Total CTC
- Employer contributions included

## Benefits

1. ✅ **Attendance Integration**: Auto-fetches and uses actual attendance
2. ✅ **Accurate Calculations**: Based on salary_structures + attendance
3. ✅ **Same Structure**: Matches Salary Structure Setup tab
4. ✅ **Dynamic Earnings**: From earning_types table
5. ✅ **Live Preview**: See all calculations instantly
6. ✅ **Complete Breakdown**: From Fixed Salary to Total CTC

## Next Steps

1. Update `src/components/salary/SalaryManagement.tsx`
2. Add attendance fetch logic
3. Update form structure
4. Replace edit dialog JSX
5. Test with real data
