// This is the new Edit Salary Dialog JSX to replace the old one
// Replace the entire {/* Edit Salary Dialog */} section (lines 1473-end) with this

{/* Edit Salary Dialog */}
<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Calculator className="h-5 w-5" />
        Edit Salary - {selectedSalary?.employee_name}
      </DialogTitle>
      <DialogDescription>
        {months.find(m => m.value === selectedMonth)?.label} {selectedYear} | Attendance-based calculation
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
