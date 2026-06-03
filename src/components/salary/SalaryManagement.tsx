import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Lock, Unlock, Download, CheckCircle, Clock, AlertCircle, Calculator, RefreshCw, Plus, History, TrendingUp, Coins, FileText, Gift } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PayslipView } from "./PayslipView";

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  base_salary: number | null;
  institution_assignment: string | null;
}

interface SalaryRecord {
  id: string;
  user_id: string;
  month: number;
  year: number;
  base_salary: number;
  working_days: number;
  present_days: number | null;
  absent_days: number | null;
  paid_leave_days: number | null;
  per_day_salary: number | null;
  
  // Attendance fields (saved from attendance table)
  half_days: number | null;
  sick_leaves: number | null;
  late_days: number | null;
  holiday_count: number | null;
  
  // Fixed components
  basic_earned: number | null;
  hra_earned: number | null;
  other_allowance_earned: number | null;
  
  // Variable earnings
  variable_earnings_details: Record<string, string> | null;
  variable_earnings_total: number | null;
  
  // Deductions
  epf_employee: number | null;
  esic_employee: number | null;
  manual_deduction: number | null;
  tds_deduction: number | null;
  professional_tax: number | null;
  other_deductions: number | null;
  total_deductions: number | null;
  
  // Calculated totals
  gross_salary: number | null;
  net_salary_calculated: number | null;
  net_salary_manual: number | null;
  final_salary: number | null;
  
  // Employer contributions
  epf_employer: number | null;
  esic_employer: number | null;
  total_employer_contribution: number | null;
  total_ctc: number | null;
  
  // Approval
  manager_proposed_salary: number | null;
  manager_justification: string | null;
  approval_status: string | null;
  is_locked: boolean | null;
  locked_at: string | null;
  created_at: string;
  employee_name?: string;
  
  // Legacy fields (for backward compatibility)
  hra_amount: number | null;
  travel_allowance: number | null;
  special_bonus: number | null;
  pf_deduction: number | null;
}

interface AuditRecord {
  id: string;
  action: string;
  old_data: unknown | null;
  new_data: unknown | null;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}

interface SalaryManagementProps {
  userId: string;
  isAdmin: boolean;
  isManager: boolean;
}

// Potential Earning Dialog Component (same as in EmployeeSalaryView)
function PotentialEarningDialog({ isAdmin = false }: { isAdmin?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [earningStructure, setEarningStructure] = useState<Array<{
    id?: string;
    taskType: string;
    rate: number;
    tasksPerMonth: number;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    monthlyEarning: number;
    howToEarn: string;
    displayOrder: number;
  }>>([]);

  const fetchEarningStructure = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("earning_structure" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        taskType: item.task_type,
        rate: Number(item.rate),
        tasksPerMonth: item.tasks_per_month,
        frequency: item.frequency as "DAILY" | "WEEKLY" | "MONTHLY",
        monthlyEarning: Number(item.rate) * item.tasks_per_month,
        howToEarn: item.how_to_earn || "",
        displayOrder: item.display_order,
      }));

      setEarningStructure(mapped);
    } catch (error) {
      console.error("Error fetching earning structure:", error);
      toast({
        title: "Error",
        description: "Failed to load earning structure",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarningStructure();
  }, []);

  const updateEarning = (index: number, field: string, value: any) => {
    const updated = [...earningStructure];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'rate' || field === 'tasksPerMonth') {
      updated[index].monthlyEarning = updated[index].rate * updated[index].tasksPerMonth;
    }
    
    setEarningStructure(updated);
  };

  const addNewRow = () => {
    const newRow = {
      taskType: "New Task Type",
      rate: 0,
      tasksPerMonth: 0,
      frequency: "DAILY" as const,
      monthlyEarning: 0,
      howToEarn: "",
      displayOrder: earningStructure.length + 1,
    };
    setEarningStructure([...earningStructure, newRow]);
  };

  const removeRow = async (index: number) => {
    const item = earningStructure[index];
    
    // If item has ID, soft delete from database
    if (item.id) {
      try {
        const { error } = await supabase
          .from("earning_structure" as any)
          .update({ is_active: false })
          .eq("id", item.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task type removed successfully",
        });
      } catch (error) {
        console.error("Error removing task type:", error);
        toast({
          title: "Error",
          description: "Failed to remove task type",
          variant: "destructive",
        });
        return;
      }
    }

    // Remove from state
    const updated = earningStructure.filter((_, i) => i !== index);
    setEarningStructure(updated);
  };

  const handleSave = async () => {
    try {
      // Update or insert each row
      for (let i = 0; i < earningStructure.length; i++) {
        const item = earningStructure[i];
        const dbData = {
          task_type: item.taskType,
          rate: item.rate,
          tasks_per_month: item.tasksPerMonth,
          frequency: item.frequency,
          how_to_earn: item.howToEarn,
          display_order: i + 1,
          is_active: true,
        };

        if (item.id) {
          // Update existing
          const { error } = await supabase
            .from("earning_structure" as any)
            .update(dbData)
            .eq("id", item.id);

          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from("earning_structure" as any)
            .insert(dbData);

          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: "Earning structure updated successfully",
      });
      setIsEditing(false);
      fetchEarningStructure(); // Refresh data
    } catch (error) {
      console.error("Error saving earning structure:", error);
      toast({
        title: "Error",
        description: "Failed to save earning structure",
        variant: "destructive",
      });
    }
  };

  const totalPotential = earningStructure.reduce((sum, item) => sum + item.monthlyEarning, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Potential Earning
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Coins className="h-6 w-6 text-primary" />
                Reward Structure & Monthly Potential
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how much students can earn for each task type
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      fetchEarningStructure(); // Reset changes
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className="gap-2"
                >
                  {isEditing ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4" />
                      Edit Structure
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Task Type</TableHead>
                    <TableHead className="text-center font-semibold">Tasks/Month</TableHead>
                    <TableHead className="text-center font-semibold">Frequency</TableHead>
                    <TableHead className="text-center font-semibold">Rate (₹)</TableHead>
                    <TableHead className="text-center font-semibold">Monthly (₹)</TableHead>
                    <TableHead className="font-semibold">How to Earn</TableHead>
                    {isEditing && <TableHead className="text-center font-semibold">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earningStructure.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.taskType}
                            onChange={(e) => updateEarning(index, 'taskType', e.target.value)}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          item.taskType
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.tasksPerMonth}
                            onChange={(e) => updateEarning(index, 'tasksPerMonth', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center border rounded"
                          />
                        ) : (
                          item.tasksPerMonth
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <select
                            value={item.frequency}
                            onChange={(e) => updateEarning(index, 'frequency', e.target.value)}
                            className="px-2 py-1 border rounded text-xs"
                          >
                            <option value="DAILY">DAILY</option>
                            <option value="WEEKLY">WEEKLY</option>
                            <option value="MONTHLY">MONTHLY</option>
                          </select>
                        ) : (
                          <Badge variant={item.frequency === "DAILY" ? "default" : "secondary"} className="text-xs">
                            {item.frequency}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateEarning(index, 'rate', Number(e.target.value))}
                            className="w-20 px-2 py-1 text-center border rounded"
                          />
                        ) : (
                          `₹${item.rate}`
                        )}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-bold">
                        ₹{item.monthlyEarning}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.howToEarn}
                            onChange={(e) => updateEarning(index, 'howToEarn', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          item.howToEarn
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {isEditing && (
              <Button
                variant="outline"
                onClick={addNewRow}
                className="w-full gap-2 border-dashed"
              >
                <Plus className="h-4 w-4" />
                Add New Task Type
              </Button>
            )}

            <div className="flex items-center justify-center gap-4 p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
              <span className="text-xl font-semibold">Total Potential Monthly:</span>
              <span className="text-3xl font-bold text-primary">₹{totalPotential.toLocaleString()}</span>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This table reflects the standardized reward rates. Individual student earnings are calculated based on these rates when tasks are marked as completed.
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SalaryManagement({ userId, isAdmin, isManager }: SalaryManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [unlockReason, setUnlockReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAttendanceEditable, setIsAttendanceEditable] = useState(false); // New state for attendance editing
  
  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"employee" | "base_salary" | "working_days" | "present" | "gross" | "net_salary">("employee");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Earning types for variable earnings
  const [earningTypes, setEarningTypes] = useState<Array<{
    earning_code: string;
    earning_name: string;
  }>>([]);

  // Fetch earning types for variable earnings
  useEffect(() => {
    const fetchEarningTypes = async () => {
      const { data } = await supabase
        .from("earning_types" as any)
        .select("earning_code, earning_name")
        .eq("is_active", true)
        .order("display_order");
      
      setEarningTypes(data || []);
    };
    
    fetchEarningTypes();
  }, []);

  // Form state - Updated with complete structure
  const [formData, setFormData] = useState({
    // From salary_structures
    fixed_gross_salary: 0,
    basic_percentage: 50,
    hra_percentage: 40,
    other_allowance_percentage: 30,
    
    // Attendance (auto-fetched)
    working_days: 0,
    present_days: 0,
    half_days: 0,
    paid_leave_days: 0,
    sick_leaves: 0,
    absent_days: 0,
    late_days: 0,
    holiday_count: 0,
    
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch employees
      const { data: empData } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, base_salary, institution_assignment")
        .eq("is_active", true);

      setEmployees(empData || []);

      // Fetch salary records for selected month/year
      const { data: salaryData, error } = await supabase
        .from("salaries")
        .select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map employee names to salary records
      const recordsWithNames = (salaryData || []).map(record => {
        const emp = empData?.find(e => e.user_id === record.user_id);
        return {
          ...record,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
        };
      });

      setSalaryRecords(recordsWithNames);
    } catch (error) {
      console.error("Error fetching salary data:", error);
      toast({
        title: "Error",
        description: "Failed to load salary data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch earning types for variable earnings
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

  // Live calculation based on form data - UPDATED WITH COMPLETE STRUCTURE
  const calculateSalary = useCallback(() => {
    // NEW FORMULA:
    // Per Day Rate = Fixed Gross Salary / Payroll Days (total days in month)
    // Gross Earned = Per Day Rate × Total Paid Days
    
    const payrollDays = new Date(selectedYear, selectedMonth, 0).getDate(); // Total days in month
    
    const perDayRate = payrollDays > 0 
      ? formData.fixed_gross_salary / payrollDays 
      : 0;
    
    // Calculate late sets: 3 late = 1 set
    const lateSets = Math.floor(formData.late_days / 3);
    
    // Total Paid Days = PR + HO + (HD × 0.5) + PL - Late Sets - AB
    const totalPaidDays = formData.present_days + formData.holiday_count + (formData.half_days * 0.5) + formData.paid_leave_days - lateSets - formData.absent_days;
    
    // Gross Earned = Per Day Rate × Total Paid Days
    const grossEarned = totalPaidDays * perDayRate;
    
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
    
    // Total CTC = Net Payable + Employer Contributions
    const totalCTC = netPayable + totalEmployerBenefit;
    
    // Debug logging
    console.log("CTC Calculation Debug (NEW FORMULA):", {
      payrollDays,
      perDayRate,
      totalPaidDays,
      grossEarned,
      totalGrossEarnings,
      totalDeductions,
      netPayable,
      epfEmployer,
      esicEmployer,
      totalEmployerBenefit,
      totalCTC,
      lateSets,
      formula: `Per Day Rate (${perDayRate}) × Total Paid Days (${totalPaidDays}) = Gross Earned (${grossEarned})`
    });
    
    return {
      perDayRate: Math.round(perDayRate * 100) / 100,
      lateSets: lateSets,
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
  }, [formData, selectedYear, selectedMonth]);

  const generateMonthlySalaries = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_monthly_salaries", {
        p_year: selectedYear,
        p_month: selectedMonth,
      });

      if (error) throw error;

      const result = data as { created: number; skipped: number; working_days: number };
      
      toast({
        title: "Salaries Generated",
        description: `Created ${result.created} new records, ${result.skipped} already existed. Working days: ${result.working_days}`,
      });
      
      // After generating salaries, populate attendance details for all records
      await populateAttendanceDetailsForMonth();
      
      // Save attendance summary to attendance_summary table for all employees
      await saveAttendanceSummaryForAllEmployees();
      
      fetchData();
    } catch (error) {
      console.error("Error generating salaries:", error);
      toast({
        title: "Error",
        description: "Failed to generate salary records",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const populateAttendanceDetailsForMonth = async () => {
    try {
      // Fetch all salary records for the month
      const { data: salaries, error: salaryError } = await supabase
        .from("salaries")
        .select("id, user_id")
        .eq("month", selectedMonth)
        .eq("year", selectedYear);

      if (salaryError) throw salaryError;

      if (!salaries || salaries.length === 0) {
        console.log("No salary records found for this month");
        return;
      }

      // For each salary record, fetch attendance data from attendance_summary table
      for (const salary of salaries) {
        try {
          // Fetch attendance summary data from attendance_summary table
          const { data: attendanceSummaryData, error: summaryError } = await supabase
            .from("attendance_summary")
            .select("*")
            .eq("user_id", salary.user_id)
            .eq("year", selectedYear)
            .eq("month", selectedMonth)
            .maybeSingle();

          if (summaryError) {
            console.warn(`Warning: Could not fetch attendance summary for user ${salary.user_id}:`, summaryError);
            continue;
          }

          if (!attendanceSummaryData) {
            console.log(`No attendance summary found for user ${salary.user_id} - ${selectedYear}-${selectedMonth}`);
            continue;
          }

          // Update salary record with attendance details from attendance_summary table
          const { error: updateError } = await supabase
            .from("salaries")
            .update({
              present_days: attendanceSummaryData.present_days,
              half_days: attendanceSummaryData.half_days,
              paid_leave_days: attendanceSummaryData.paid_leave_days,
              sick_leaves: attendanceSummaryData.leave_days,
              absent_days: attendanceSummaryData.absent_days,
              late_days: attendanceSummaryData.late_days,
              holiday_count: attendanceSummaryData.holiday_count,
              updated_at: new Date().toISOString(),
            })
            .eq("id", salary.id);

          if (updateError) {
            console.warn(`Warning: Could not update attendance for salary ${salary.id}:`, updateError);
          } else {
            console.log(`Updated salary ${salary.id} with attendance data from attendance_summary table`);
          }
        } catch (error) {
          console.error(`Error processing attendance for salary ${salary.id}:`, error);
        }
      }

      console.log(`Populated attendance details for ${salaries.length} salary records from attendance_summary table`);
    } catch (error) {
      console.error("Error populating attendance details:", error);
    }
  };

  // Function to save attendance summary for a single employee to attendance_summary table
  const saveAttendanceSummaryForEmployee = async (
    userId: string,
    year: number,
    month: number,
    attendanceSummary: any
  ) => {
    try {
      const payrollDays = new Date(year, month, 0).getDate();
      const lateSets = Math.floor(attendanceSummary.lateDays / 3);
      
      // Calculate total paid days using NEW FORMULA (no 2x on AB, no LE)
      const totalPaidDays = attendanceSummary.presentDays + 
                           attendanceSummary.holidayCount + 
                           (attendanceSummary.halfDays * 0.5) + 
                           attendanceSummary.paidLeaveDays - 
                           lateSets - 
                           attendanceSummary.absentDays;
      
      // Calculate attendance percentage
      const attendancePercentage = payrollDays > 0 
        ? (totalPaidDays / payrollDays) * 100 
        : 0;
      
      const { error } = await supabase
        .from("attendance_summary")
        .upsert({
          user_id: userId,
          year: year,
          month: month,
          payroll_days: payrollDays,
          present_days: attendanceSummary.presentDays,
          half_days: attendanceSummary.halfDays,
          holiday_count: attendanceSummary.holidayCount,
          paid_leave_days: attendanceSummary.paidLeaveDays,
          leave_days: attendanceSummary.sickLeaves,
          absent_days: attendanceSummary.absentDays,
          late_days: attendanceSummary.lateDays,
          late_sets: lateSets,
          total_paid_days: Math.round(totalPaidDays * 100) / 100,
          attendance_percentage: Math.round(attendancePercentage * 100) / 100,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,year,month'
        });
      
      if (error) {
        console.error(`Error saving attendance summary for user ${userId}:`, error);
        return false;
      }
      
      console.log(`Saved attendance summary for user ${userId} - ${year}-${month}`);
      return true;
    } catch (error) {
      console.error(`Error in saveAttendanceSummaryForEmployee:`, error);
      return false;
    }
  };

  // Function to save attendance summary for all employees in a month
  const saveAttendanceSummaryForAllEmployees = async () => {
    try {
      console.log(`Starting to save attendance summary for all employees - ${selectedYear}-${selectedMonth}`);
      
      // Fetch all active employees
      const { data: employees, error: empError } = await supabase
        .from("employee_profiles")
        .select("user_id")
        .eq("is_active", true);
      
      if (empError) throw empError;
      
      if (!employees || employees.length === 0) {
        console.log("No active employees found");
        return;
      }
      
      let successCount = 0;
      let failureCount = 0;
      
      // For each employee, calculate and save attendance summary
      for (const emp of employees) {
        try {
          // Fetch attendance data for this employee
          const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
          
          const { data: attendanceData } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", emp.user_id)
            .gte("date", startDate)
            .lte("date", endDate);
          
          // Calculate attendance summary
          const attendanceSummary = await calculateAttendanceSummary(emp.user_id, attendanceData || []);
          
          // Save to attendance_summary table
          const saved = await saveAttendanceSummaryForEmployee(
            emp.user_id,
            selectedYear,
            selectedMonth,
            attendanceSummary
          );
          
          if (saved) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(`Error processing employee ${emp.user_id}:`, error);
          failureCount++;
        }
      }
      
      console.log(`Attendance summary save complete: ${successCount} successful, ${failureCount} failed`);
      
      toast({
        title: "Attendance Summary Saved",
        description: `Saved attendance data for ${successCount} employees. ${failureCount > 0 ? `${failureCount} failed.` : ''}`,
      });
      
      return successCount;
    } catch (error) {
      console.error("Error in saveAttendanceSummaryForAllEmployees:", error);
      toast({
        title: "Error",
        description: "Failed to save attendance summary",
        variant: "destructive",
      });
      return 0;
    }
  };

  // Function to add holiday to all employees for a specific month
  const addHolidayToAllEmployees = async (month: number, year: number) => {
    try {
      // Fetch all attendance summary records for the month
      const { data: records, error: fetchError } = await supabase
        .from("attendance_summary")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (fetchError) throw fetchError;

      if (!records || records.length === 0) {
        toast({
          title: "No Records Found",
          description: `No attendance summary records found for ${month}/${year}`,
          variant: "destructive",
        });
        return;
      }

      // Update each record
      let successCount = 0;
      let failureCount = 0;

      for (const record of records) {
        try {
          const newTotalPaidDays = record.total_paid_days + 1;
          const newAttendancePercentage = record.payroll_days > 0 
            ? Math.round((newTotalPaidDays / record.payroll_days) * 100 * 100) / 100
            : 0;

          const { error: updateError } = await supabase
            .from("attendance_summary")
            .update({
              holiday_count: record.holiday_count + 1,
              total_paid_days: newTotalPaidDays,
              attendance_percentage: newAttendancePercentage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError);
            failureCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing record ${record.id}:`, error);
          failureCount++;
        }
      }

      toast({
        title: "Holiday Added",
        description: `Added 1 holiday to ${successCount} employees. ${failureCount > 0 ? `${failureCount} failed.` : ''}`,
      });

      // Refresh data if needed
      fetchData();
    } catch (error) {
      console.error("Error adding holiday:", error);
      toast({
        title: "Error",
        description: "Failed to add holiday to attendance summary",
        variant: "destructive",
      });
    }
  };

  const recalculateAllSalaries = async () => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only admins can recalculate salaries",
        variant: "destructive",
      });
      return;
    }

    // Filter: only unlocked salaries ko recalculate karunga
    const unlockedSalaries = salaryRecords.filter(s => !s.is_locked);
    
    if (unlockedSalaries.length === 0) {
      toast({
        title: "No Salaries to Recalculate",
        description: "All salaries are locked. Unlock them first to recalculate.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    let attendanceSummarySuccessCount = 0;
    let attendanceSummaryErrorCount = 0;
    let salarySuccessCount = 0;
    let salaryErrorCount = 0;
    let salarySkippedCount = 0;

    try {
      // STEP 1: Update attendance_summary table for ALL employees (including locked ones - because attendance data is independent)
      console.log(`Step 1: Updating attendance summary table for all employees...`);
      
      for (const salary of salaryRecords) {
        try {
          // Fetch attendance data for this employee
          const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
          
          const { data: attendanceData, error: attendanceError } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", salary.user_id)
            .gte("date", startDate)
            .lte("date", endDate);
          
          if (attendanceError) {
            console.warn(`Warning: Could not fetch attendance data for ${salary.employee_name}:`, attendanceError);
            attendanceSummaryErrorCount++;
            continue;
          }
          
          // Calculate attendance summary
          const attendanceSummary = await calculateAttendanceSummary(salary.user_id, attendanceData || []);
          
          // Save to attendance_summary table
          const saved = await saveAttendanceSummaryForEmployee(
            salary.user_id,
            selectedYear,
            selectedMonth,
            attendanceSummary
          );
          
          if (saved) {
            attendanceSummarySuccessCount++;
          } else {
            attendanceSummaryErrorCount++;
          }
        } catch (err) {
          console.error(`Error updating attendance summary for ${salary.employee_name}:`, err);
          attendanceSummaryErrorCount++;
        }
      }
      
      console.log(`Step 1 Complete: ${attendanceSummarySuccessCount} attendance summaries updated, ${attendanceSummaryErrorCount} errors`);
      
      // STEP 2: Update ONLY unlocked salaries using attendance_summary table data
      console.log(`Step 2: Recalculating ${unlockedSalaries.length} unlocked salary records...`);
      
      for (const salary of unlockedSalaries) {
        try {
          // Double-check that salary is still unlocked (in case it changed)
          if (salary.is_locked) {
            console.log(`Skipping locked salary for ${salary.employee_name}`);
            salarySkippedCount++;
            continue;
          }
          
          // Fetch latest attendance summary from table
          const { data: summaryData, error: summaryError } = await supabase
            .from("attendance_summary")
            .select("*")
            .eq("user_id", salary.user_id)
            .eq("year", selectedYear)
            .eq("month", selectedMonth)
            .maybeSingle();
          
          if (summaryError) {
            console.warn(`Warning: Could not fetch attendance summary for ${salary.employee_name}:`, summaryError);
            salaryErrorCount++;
            continue;
          }
          
          // Get working days
          const { data: workingDaysData } = await supabase
            .rpc('calculate_monthly_working_days', {
              p_year: selectedYear,
              p_month: selectedMonth
            });
          
          const actualWorkingDays = workingDaysData || salary.working_days || 26;
          
          // Use attendance_summary data (or defaults)
          const payrollDays = (summaryData as any)?.payroll_days || new Date(selectedYear, selectedMonth, 0).getDate();
          const presentDays = (summaryData as any)?.present_days || 0;
          const halfDays = (summaryData as any)?.half_days || 0;
          const holidayCount = (summaryData as any)?.holiday_count || 0;
          const paidLeaveDays = (summaryData as any)?.paid_leave_days || 0;
          const absentDays = (summaryData as any)?.absent_days || 0;
          const lateDays = (summaryData as any)?.late_days || 0;
          const sickLeaves = (summaryData as any)?.leave_days || 0;
          
          // Fetch salary structure
          const { data: structure, error: structureError } = await supabase
            .from("salary_structures" as any)
            .select("*")
            .eq("user_id", salary.user_id)
            .eq("is_active", true)
            .maybeSingle();
          
          if (structureError) {
            console.warn(`Warning: Could not fetch salary structure for ${salary.employee_name}:`, structureError);
            salaryErrorCount++;
            continue;
          }
          
          const fixedGrossSalary = (structure as any)?.fixed_gross_salary || salary.base_salary || 0;
          const basicPercentage = (structure as any)?.basic_percentage || 50;
          const hraPercentage = (structure as any)?.hra_percentage || 40;
          const otherAllowancePercentage = (structure as any)?.other_allowance_percentage || 30;
          
          // Calculate with payroll days (total days in month)
          const perDayRate = payrollDays > 0 ? fixedGrossSalary / payrollDays : 0;
          
          // Late set deduction: 3 lates = 1 set
          const lateSets = Math.floor(lateDays / 3);
          
          // Paid Day Units (NEW FORMULA)
          // = PR + HO + (HD × 0.5) + PL - Late Sets - AB
          const paidDayUnits = presentDays + holidayCount + (halfDays * 0.5) + paidLeaveDays - lateSets - absentDays;
          
          // Gross earned
          const grossEarned = paidDayUnits * perDayRate;
          
          // Fixed components
          const basicEarned = grossEarned * (basicPercentage / 100);
          const hraEarned = basicEarned * (hraPercentage / 100);
          const otherAllowanceEarned = grossEarned * (otherAllowancePercentage / 100);
          
          // Variable earnings
          const totalVariableEarnings = Object.values(salary.variable_earnings_details || {}).reduce(
            (sum, val) => sum + (parseFloat(val as any) || 0), 0
          );
          
          // Total gross
          const totalGrossEarnings = grossEarned + totalVariableEarnings;
          
          // Deductions
          const epfEmployee = ((structure as any)?.epf_applicable ?? true) 
            ? (basicEarned * ((structure as any)?.epf_employee_rate || 12) / 100) 
            : 0;
          const esicEmployee = ((structure as any)?.esic_applicable ?? true) 
            ? (totalGrossEarnings * ((structure as any)?.esic_employee_rate || 0.75) / 100) 
            : 0;
          const totalDeductions = epfEmployee + esicEmployee + 
            (salary.manual_deduction || 0) + (salary.tds_deduction || 0) + 
            (salary.professional_tax || 0) + (salary.other_deductions || 0);
          
          // Net payable
          const netPayable = totalGrossEarnings - totalDeductions;
          
          // Employer contributions
          const epfEmployer = ((structure as any)?.epf_applicable ?? true) 
            ? (basicEarned * ((structure as any)?.epf_employee_rate || 12) / 100) 
            : 0;
          const esicEmployer = ((structure as any)?.esic_applicable ?? true) 
            ? (totalGrossEarnings * 3.25 / 100) 
            : 0;
          const totalEmployerBenefit = epfEmployer + esicEmployer;
          
          // Update salary record
          const { error: updateError } = await supabase
            .from("salaries")
            .update({
              working_days: actualWorkingDays,
              present_days: presentDays,
              absent_days: absentDays,
              paid_leave_days: paidLeaveDays,
              half_days: halfDays,
              holiday_count: holidayCount,
              late_days: lateDays,
              sick_leaves: sickLeaves,
              
              per_day_salary: Math.round(perDayRate * 100) / 100,
              
              basic_earned: Math.round(basicEarned * 100) / 100,
              hra_earned: Math.round(hraEarned * 100) / 100,
              other_allowance_earned: Math.round(otherAllowanceEarned * 100) / 100,
              
              variable_earnings_total: Math.round(totalVariableEarnings * 100) / 100,
              
              gross_salary: Math.round(totalGrossEarnings * 100) / 100,
              
              epf_employee: Math.round(epfEmployee * 100) / 100,
              esic_employee: Math.round(esicEmployee * 100) / 100,
              total_deductions: Math.round(totalDeductions * 100) / 100,
              
              net_salary_calculated: Math.round(netPayable * 100) / 100,
              final_salary: salary.net_salary_manual || Math.round(netPayable * 100) / 100,
              
              epf_employer: Math.round(epfEmployer * 100) / 100,
              esic_employer: Math.round(esicEmployer * 100) / 100,
              total_employer_contribution: Math.round(totalEmployerBenefit * 100) / 100,
              total_ctc: Math.round((netPayable + totalEmployerBenefit) * 100) / 100,
              
              updated_at: new Date().toISOString(),
            })
            .eq("id", salary.id);
          
          if (updateError) {
            console.error(`Error updating salary for ${salary.employee_name}:`, updateError);
            salaryErrorCount++;
          } else {
            console.log(`Successfully recalculated salary for ${salary.employee_name}`);
            salarySuccessCount++;
          }
        } catch (err) {
          console.error(`Error processing salary for ${salary.employee_name}:`, err);
          salaryErrorCount++;
        }
      }
      
      console.log(`Step 2 Complete: ${salarySuccessCount} salaries updated, ${salarySkippedCount} skipped (locked), ${salaryErrorCount} errors`);
      
      // Toast with detailed summary
      toast({
        title: "Recalculation Complete",
        description: `✓ Attendance: ${attendanceSummarySuccessCount} updated | Salary: ${salarySuccessCount} recalculated, ${salarySkippedCount} locked, ${salaryErrorCount} errors`,
      });
      
      fetchData();
    } catch (error) {
      console.error("Error in recalculation process:", error);
      toast({
        title: "Error",
        description: "Failed to recalculate salaries",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const calculateAttendanceSummary = async (
    userId: string,
    attendanceRecords: any[],
    holidays: any[] = []
  ) => {
    // Use the same RPC as the Attendance page so numbers match exactly
    const { data: statsData } = await supabase.rpc('calculate_attendance_stats', {
      p_user_id: userId,
      p_year: selectedYear,
      p_month: selectedMonth,
    });
    const stats = (statsData as any) || {};

    // Fetch holidays from BOTH sources
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
    
    // Source 1: holidays_view (derived from attendance with status='holiday')
    const { data: holidaysTableData } = await supabase
      .from("holidays_view")
      .select("date, name")
      .gte("date", startDate)
      .lte("date", endDate);
    
    // Source 2: Fetch from attendance table (where calculated_status = 'holiday')
    const { data: holidaysFromAttendance } = await supabase
      .from("attendance")
      .select("date, status, calculated_status")
      .gte("date", startDate)
      .lte("date", endDate);
    
    // Filter for holiday records from attendance table
    const holidayRecordsFromAttendance = (holidaysFromAttendance || []).filter(r => 
      r.calculated_status?.toLowerCase() === 'holiday'
    );
    
    // Combine holidays from both sources (remove duplicates)
    const allHolidayDates = new Set<string>();
    
    // Add holidays from holidays table
    (holidaysTableData || []).forEach(h => {
      const dateStr = new Date(h.date).toISOString().split('T')[0];
      allHolidayDates.add(dateStr);
    });
    
    // Add holidays from attendance table
    holidayRecordsFromAttendance.forEach(h => {
      const dateStr = new Date(h.date).toISOString().split('T')[0];
      allHolidayDates.add(dateStr);
    });
    
    console.log("Fetched holidays from both sources:", {
      startDate,
      endDate,
      fromHolidaysTable: holidaysTableData?.length || 0,
      fromAttendanceTable: holidayRecordsFromAttendance.length,
      totalUnique: allHolidayDates.size,
      allHolidayDates: Array.from(allHolidayDates),
    });

    // Count holidays where employee actually worked (present/late/half_day/paid_leave)
    const holidaysWorked = attendanceRecords.filter(r => {
      if (r.user_id !== userId) return false;
      if (new Date(r.date).getMonth() !== selectedMonth - 1) return false;
      if (new Date(r.date).getFullYear() !== selectedYear) return false;
      
      const recordDate = new Date(r.date).toISOString().split('T')[0];
      const isHolidayDate = allHolidayDates.has(recordDate);
      const calcStatus = r.calculated_status?.toLowerCase();
      const isPresent =
        calcStatus === 'present' ||
        calcStatus === 'late' ||
        calcStatus === 'half_day' ||
        r.is_half_day ||
        r.is_late ||
        calcStatus === 'paid_leave';
      
      return isHolidayDate && isPresent && r.status !== 'rejected';
    });
    
    const uniqueHolidaysWorked = new Set(
      holidaysWorked.map(r => new Date(r.date).toISOString().split('T')[0])
    );
    
    // Holiday count = total holidays - holidays worked
    const holidayCount = allHolidayDates.size - uniqueHolidaysWorked.size;

    console.log("Holiday Calculation Debug:", {
      totalHolidaysInMonth: allHolidayDates.size,
      holidaysWorked: uniqueHolidaysWorked.size,
      holidayCount,
      holidaysList: Array.from(allHolidayDates),
      attendanceRecordsCount: attendanceRecords.length,
    });

    return {
      presentDays: Number(stats.present_days) || 0,
      halfDays: Number(stats.half_days) || 0,
      paidLeaveDays: Number(stats.casual_leaves) || 0,
      sickLeaves: Number(stats.sick_leaves) || 0,
      absentDays: Number(stats.absent_days) || 0,
      lateDays: Number(stats.late_days) || 0,
      holidayCount,
    };
  };

  // Function to recalculate holiday count based on current attendance data
  const recalculateHolidayCount = async (attendanceData: any[]) => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      // Fetch holidays from holidays_view
      const { data: holidaysTableData } = await supabase
        .from("holidays_view")
        .select("date, name")
        .gte("date", startDate)
        .lte("date", endDate);
      
      const { data: holidaysFromAttendance } = await supabase
        .from("attendance")
        .select("date, status, calculated_status")
        .gte("date", startDate)
        .lte("date", endDate);
      
      const holidayRecordsFromAttendance = (holidaysFromAttendance || []).filter(r => 
        r.calculated_status?.toLowerCase() === 'holiday'
      );
      
      // Combine holidays from both sources
      const allHolidayDates = new Set<string>();
      
      (holidaysTableData || []).forEach(h => {
        const dateStr = new Date(h.date).toISOString().split('T')[0];
        allHolidayDates.add(dateStr);
      });
      
      holidayRecordsFromAttendance.forEach(h => {
        const dateStr = new Date(h.date).toISOString().split('T')[0];
        allHolidayDates.add(dateStr);
      });
      
      // Count holidays where employee worked
      const holidaysWorked = attendanceData.filter(r => {
        if (new Date(r.date).getMonth() !== selectedMonth - 1) return false;
        if (new Date(r.date).getFullYear() !== selectedYear) return false;
        
        const recordDate = new Date(r.date).toISOString().split('T')[0];
        const isHolidayDate = allHolidayDates.has(recordDate);
        const calcStatus = r.calculated_status?.toLowerCase();
        const isPresent =
          calcStatus === 'present' ||
          calcStatus === 'late' ||
          calcStatus === 'half_day' ||
          r.is_half_day ||
          r.is_late ||
          calcStatus === 'paid_leave';
        
        return isHolidayDate && isPresent && r.status !== 'rejected';
      });
      
      const uniqueHolidaysWorked = new Set(
        holidaysWorked.map(r => new Date(r.date).toISOString().split('T')[0])
      );
      
      const calculatedHolidayCount = allHolidayDates.size - uniqueHolidaysWorked.size;
      
      console.log("Recalculated Holiday Count:", {
        totalHolidays: allHolidayDates.size,
        holidaysWorked: uniqueHolidaysWorked.size,
        calculatedHolidayCount,
      });
      
      return calculatedHolidayCount;
    } catch (error) {
      console.error("Error recalculating holiday count:", error);
      return 0;
    }
  };

  const openEditDialog = async (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setLoading(true);
    
    try {
      // 1. Fetch employee's salary structure
      const { data: structure } = await supabase
        .from("salary_structures" as any)
        .select("*")
        .eq("user_id", salary.user_id)
        .eq("is_active", true)
        .maybeSingle();
      
      // 2. Check if attendance data is already saved in salaries table
      const hasAttendanceDataInSalaries = 
        salary.present_days !== null && 
        salary.absent_days !== null && 
        salary.paid_leave_days !== null;
      
      let attendanceSummary;
      
      if (hasAttendanceDataInSalaries) {
        // Use existing data from salaries table (already saved)
        attendanceSummary = {
          presentDays: salary.present_days || 0,
          halfDays: salary.half_days || 0,
          paidLeaveDays: salary.paid_leave_days || 0,
          sickLeaves: salary.sick_leaves || 0,
          absentDays: salary.absent_days || 0,
          lateDays: salary.late_days || 0,
          holidayCount: salary.holiday_count || 0,
        };
      } else {
        // First time: fetch from attendance_summary table
        const { data: attendanceSummaryData, error: summaryError } = await supabase
          .from("attendance_summary")
          .select("*")
          .eq("user_id", salary.user_id)
          .eq("year", selectedYear)
          .eq("month", selectedMonth)
          .maybeSingle();
        
        if (summaryError) {
          console.warn("Warning: Could not fetch attendance summary:", summaryError);
        }
        
        if (attendanceSummaryData) {
          // Use data from attendance_summary table
          attendanceSummary = {
            presentDays: attendanceSummaryData.present_days || 0,
            halfDays: attendanceSummaryData.half_days || 0,
            paidLeaveDays: attendanceSummaryData.paid_leave_days || 0,
            sickLeaves: attendanceSummaryData.leave_days || 0,
            absentDays: attendanceSummaryData.absent_days || 0,
            lateDays: attendanceSummaryData.late_days || 0,
            holidayCount: attendanceSummaryData.holiday_count || 0,
          };
          
          console.log("Fetched attendance summary from attendance_summary table:", attendanceSummary);
          
          // Save attendance data to salaries table for future reference
          const { error: updateError } = await supabase
            .from("salaries")
            .update({
              present_days: attendanceSummary.presentDays,
              half_days: attendanceSummary.halfDays,
              paid_leave_days: attendanceSummary.paidLeaveDays,
              sick_leaves: attendanceSummary.sickLeaves,
              absent_days: attendanceSummary.absentDays,
              late_days: attendanceSummary.lateDays,
              holiday_count: attendanceSummary.holidayCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", salary.id);
          
          if (updateError) {
            console.warn("Warning: Could not save attendance data to salaries table:", updateError);
          }
        } else {
          // Fallback: if no attendance_summary data, use zeros
          console.log("No attendance summary found, using default values");
          attendanceSummary = {
            presentDays: 0,
            halfDays: 0,
            paidLeaveDays: 0,
            sickLeaves: 0,
            absentDays: 0,
            lateDays: 0,
            holidayCount: 0,
          };
        }
      }
      
      // 3. Calculate actual working days using RPC function
      const { data: workingDaysData } = await supabase
        .rpc('calculate_monthly_working_days', {
          p_year: selectedYear,
          p_month: selectedMonth
        });
      
      const actualWorkingDays = workingDaysData || salary.working_days || 26;
      
      // 4. Set form data with all values
      setFormData({
        // From salary_structures
        fixed_gross_salary: (structure as any)?.fixed_gross_salary || salary.base_salary || 0,
        basic_percentage: (structure as any)?.basic_percentage || 50,
        hra_percentage: (structure as any)?.hra_percentage || 40,
        other_allowance_percentage: (structure as any)?.other_allowance_percentage || 30,
        
        // Attendance (from salaries table - not from attendance table)
        working_days: actualWorkingDays,
        present_days: attendanceSummary.presentDays,
        half_days: attendanceSummary.halfDays,
        paid_leave_days: attendanceSummary.paidLeaveDays,
        sick_leaves: attendanceSummary.sickLeaves,
        absent_days: attendanceSummary.absentDays,
        late_days: attendanceSummary.lateDays,
        holiday_count: attendanceSummary.holidayCount,
        
        // Variable earnings (from existing salary record)
        variable_earnings: salary.variable_earnings_details || {},
        
        // Deductions
        epf_percentage: (structure as any)?.epf_employee_rate || 12,
        esic_percentage: (structure as any)?.esic_employee_rate || 0.75,
        epf_applicable: (structure as any)?.epf_applicable ?? true,
        esic_applicable: (structure as any)?.esic_applicable ?? true,
        manual_deduction: salary.manual_deduction || 0,
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
      setIsAttendanceEditable(false); // Reset to read-only when opening dialog
      setEditDialogOpen(true);
    }
  };

  const openHistoryDialog = async (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    try {
      const { data, error } = await supabase
        .from("salary_audit")
        .select("*")
        .eq("salary_id", salary.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAuditHistory(data || []);
      setHistoryDialogOpen(true);
    } catch (error) {
      console.error("Error fetching audit history:", error);
      toast({
        title: "Error",
        description: "Failed to load audit history",
        variant: "destructive",
      });
    }
  };

  const openPayslipDialog = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setPayslipDialogOpen(true);
  };

  const openUnlockDialog = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setUnlockReason("");
    setUnlockDialogOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!selectedSalary) return;

    setIsSubmitting(true);
    try {
      const calculated = calculateSalary();

      // Only update attendance-related fields (don't require unlocking)
      const updateData: Record<string, unknown> = {
        // Attendance - All fields that can be edited
        working_days: formData.working_days,
        present_days: formData.present_days,
        paid_leave_days: formData.paid_leave_days,
        absent_days: formData.absent_days,
        half_days: formData.half_days,
        holiday_count: formData.holiday_count,
        late_days: formData.late_days,
        sick_leaves: formData.sick_leaves,
        
        // Recalculate salary based on new attendance
        per_day_salary: calculated.perDayRate,
        
        // Fixed components
        basic_earned: calculated.basicEarned,
        hra_earned: calculated.hraEarned,
        other_allowance_earned: calculated.otherAllowanceEarned,
        
        // Calculated totals
        gross_salary: calculated.totalGrossEarnings,
        net_salary_calculated: calculated.netPayable,
        final_salary: selectedSalary.net_salary_manual || calculated.netPayable,
        
        // Employer contributions
        epf_employer: calculated.epfEmployer,
        esic_employer: calculated.esicEmployer,
        total_employer_contribution: calculated.totalEmployerBenefit,
        total_ctc: calculated.totalCTC,
        
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("salaries")
        .update(updateData)
        .eq("id", selectedSalary.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance updated successfully",
      });
      setIsAttendanceEditable(false);
      fetchData();
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSalary) return;

    setIsSubmitting(true);
    try {
      const calculated = calculateSalary();

      const updateData: Record<string, unknown> = {
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

      // If manager is proposing salary (not admin)
      if (isManager && !isAdmin && formData.net_salary_manual) {
        updateData.manager_proposed_salary = formData.net_salary_manual;
        updateData.manager_proposed_by = userId;
        updateData.manager_proposed_at = new Date().toISOString();
        updateData.manager_justification = formData.manager_justification;
        updateData.approval_status = "pending_approval";
      }

      // Admin directly sets and approves
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

  const handleApprove = async (salaryId: string) => {
    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          approval_status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", salaryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Salary approved successfully",
      });
      fetchData();
    } catch (error) {
      console.error("Error approving salary:", error);
      toast({
        title: "Error",
        description: "Failed to approve salary",
        variant: "destructive",
      });
    }
  };

  const handleLock = async (salaryId: string) => {
    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          is_locked: true,
          locked_by: userId,
          locked_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .eq("id", salaryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Salary locked successfully",
      });
      fetchData();
    } catch (error) {
      console.error("Error locking salary:", error);
      toast({
        title: "Error",
        description: "Failed to lock salary",
        variant: "destructive",
      });
    }
  };

  const handleUnlock = async () => {
    if (!selectedSalary || !unlockReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for unlocking",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          is_locked: false,
          locked_by: null,
          locked_at: null,
          approval_notes: `Unlocked by admin: ${unlockReason}`,
        })
        .eq("id", selectedSalary.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Salary unlocked successfully",
      });
      setUnlockDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error unlocking salary:", error);
      toast({
        title: "Error",
        description: "Failed to unlock salary",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Employee", "Month", "Year", "Base Salary", "Working Days", "Present Days", "Gross Salary", "Net Salary", "Status"];
    const rows = salaryRecords.map(s => [
      s.employee_name,
      s.month,
      s.year,
      s.base_salary,
      s.working_days,
      s.present_days,
      s.gross_salary,
      s.final_salary || s.net_salary_calculated,
      s.is_locked ? "Locked" : s.approval_status,
    ]);

    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salaries-${selectedMonth}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Salary data exported to CSV",
    });
  };

  const handleBulkApprove = async () => {
    const toApprove = salaryRecords.filter(s => 
      !s.is_locked && (s.approval_status === "draft" || s.approval_status === "pending_approval")
    );
    
    if (toApprove.length === 0) {
      toast({
        title: "No salaries to approve",
        description: "All salaries are already approved or locked",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          approval_status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .in("id", toApprove.map(s => s.id));

      if (error) throw error;

      toast({
        title: "Success",
        description: `${toApprove.length} salaries approved successfully`,
      });
      fetchData();
    } catch (error) {
      console.error("Error bulk approving salaries:", error);
      toast({
        title: "Error",
        description: "Failed to approve salaries",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockAll = async () => {
    const tolock = salaryRecords.filter(s => 
      s.approval_status === "approved" && !s.is_locked
    );
    
    if (tolock.length === 0) {
      toast({
        title: "No salaries to lock",
        description: "All approved salaries are already locked",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          is_locked: true,
          locked_by: userId,
          locked_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .in("id", tolock.map(s => s.id));

      if (error) throw error;

      toast({
        title: "Success",
        description: `${tolock.length} salaries locked successfully`,
      });
      fetchData();
    } catch (error) {
      console.error("Error locking salaries:", error);
      toast({
        title: "Error",
        description: "Failed to lock salaries",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculated = calculateSalary();
  const pendingApprovals = salaryRecords.filter(s => s.approval_status === "pending_approval" && !s.is_locked);
  const draftOrPendingCount = salaryRecords.filter(s => !s.is_locked && (s.approval_status === "draft" || s.approval_status === "pending_approval")).length;
  const approvedUnlockedCount = salaryRecords.filter(s => s.approval_status === "approved" && !s.is_locked).length;

  // Filter and sort salary records
  const filteredAndSortedRecords = salaryRecords
    .filter((record) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return record.employee_name?.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      switch (sortField) {
        case "employee":
          aValue = a.employee_name || "";
          bValue = b.employee_name || "";
          break;
        case "base_salary":
          aValue = a.base_salary || 0;
          bValue = b.base_salary || 0;
          break;
        case "working_days":
          aValue = a.working_days || 0;
          bValue = b.working_days || 0;
          break;
        case "present":
          aValue = a.present_days || 0;
          bValue = b.present_days || 0;
          break;
        case "gross":
          aValue = a.gross_salary || 0;
          bValue = b.gross_salary || 0;
          break;
        case "net_salary":
          aValue = a.final_salary || a.net_salary_calculated || 0;
          bValue = b.final_salary || b.net_salary_calculated || 0;
          break;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      const comparison = (aValue as number) - (bValue as number);
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const getStatusBadge = (salary: SalaryRecord) => {
    if (salary.is_locked) {
      return <Badge className="bg-green-500"><Lock className="h-3 w-3 mr-1" />Locked</Badge>;
    }
    switch (salary.approval_status) {
      case "approved":
        return <Badge className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "pending_approval":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Draft</Badge>;
    }
  };

  const canEditSalary = (salary: SalaryRecord) => {
    // Admin can edit any salary including locked (via unlock first)
    if (isAdmin) return !salary.is_locked;
    // Manager can edit unlocked salaries
    if (isManager) return !salary.is_locked;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-4 flex-wrap">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={generateMonthlySalaries} disabled={generating}>
            {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Generate Salaries
          </Button>
          {isAdmin && salaryRecords.length > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={recalculateAllSalaries} 
                disabled={generating}
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                Recalculate All
              </Button>

            </>
          )}
          <PotentialEarningDialog isAdmin={isAdmin} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {isAdmin && draftOrPendingCount > 0 && (
            <Button onClick={handleBulkApprove} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve All ({draftOrPendingCount})
            </Button>
          )}
          {isAdmin && approvedUnlockedCount > 0 && (
            <Button onClick={handleLockAll} disabled={isSubmitting}>
              <Lock className="h-4 w-4 mr-2" />
              Lock All ({approvedUnlockedCount})
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
      
          {/* Search Bar */}
          <div className="w-72">
            <Input
              placeholder="Search by employee name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Salary Records - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
              <CardDescription>
                View and manage employee salaries for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredAndSortedRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p>{searchQuery ? "No employees found matching your search" : "No salary records for this period"}</p>
                  {!searchQuery && (
                    <Button variant="outline" className="mt-4" onClick={generateMonthlySalaries} disabled={generating}>
                      {generating ? "Generating..." : "Generate Salary Records"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("employee")}
                        >
                          <div className="flex items-center gap-2">
                            Employee
                            {sortField === "employee" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("base_salary")}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Base Salary
                            {sortField === "base_salary" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("working_days")}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Working Days
                            {sortField === "working_days" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("present")}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Present
                            {sortField === "present" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("gross")}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Gross
                            {sortField === "gross" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("net_salary")}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Net Salary
                            {sortField === "net_salary" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedRecords.map((salary) => (
                        <TableRow key={salary.id}>
                          <TableCell className="font-medium">{salary.employee_name}</TableCell>
                          <TableCell className="text-right">₹{salary.base_salary?.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{salary.working_days}</TableCell>
                          <TableCell className="text-right">{salary.present_days || 0}</TableCell>
                          <TableCell className="text-right">₹{salary.gross_salary?.toLocaleString() || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{(salary.final_salary || salary.net_salary_calculated || 0).toLocaleString()}
                            {salary.net_salary_manual && salary.net_salary_manual !== salary.net_salary_calculated && (
                              <span className="text-xs text-muted-foreground ml-1">(manual)</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(salary)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openPayslipDialog(salary)} title="View Payslip">
                                <FileText className="h-4 w-4" />
                              </Button>
                              {canEditSalary(salary) && (
                                <Button size="sm" variant="outline" onClick={() => openEditDialog(salary)}>
                                  <Calculator className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => openHistoryDialog(salary)}>
                                <History className="h-4 w-4" />
                              </Button>
                              {isAdmin && !salary.is_locked && (salary.approval_status === "pending_approval" || salary.approval_status === "draft") && (
                                <Button size="sm" onClick={() => handleApprove(salary.id)} className="bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {isAdmin && salary.approval_status === "approved" && !salary.is_locked && (
                                <Button size="sm" onClick={() => handleLock(salary.id)}>
                                  <Lock className="h-4 w-4 mr-1" />
                                  Lock
                                </Button>
                              )}
                              {isAdmin && salary.is_locked && (
                                <Button size="sm" variant="outline" onClick={() => openUnlockDialog(salary)}>
                                  <Unlock className="h-4 w-4 mr-1" />
                                  Unlock
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && pendingApprovals.length > 0 && (
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Pending Salary Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Calculated Net</TableHead>
                      <TableHead className="text-right">Proposed Net</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((salary) => (
                      <TableRow key={salary.id}>
                        <TableCell className="font-medium">{salary.employee_name}</TableCell>
                        <TableCell className="text-right">₹{salary.net_salary_calculated?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{salary.manager_proposed_salary?.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{salary.manager_justification}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(salary)}>
                              Edit
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(salary.id)} className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

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
              {/* Attendance Summary - With Edit Toggle */}
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Attendance Summary (Auto-fetched)
                  </h4>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isAttendanceEditable ? "default" : "outline"}
                      onClick={() => setIsAttendanceEditable(!isAttendanceEditable)}
                      className="h-7 text-xs"
                    >
                      {isAttendanceEditable ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          Lock Editing
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3 w-3 mr-1" />
                          Enable Editing
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* First Row: Payroll Days, Present, Half Day, Paid Leave */}
                <div className="grid grid-cols-5 gap-4 text-sm mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Payroll Days</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={new Date(selectedYear, selectedMonth, 0).getDate()}
                        disabled
                        className="mt-1 font-semibold bg-muted"
                      />
                    ) : (
                      <p className="font-semibold text-lg">{new Date(selectedYear, selectedMonth, 0).getDate()}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Present (PR)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.present_days}
                        onChange={(e) => setFormData(p => ({ ...p, present_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-green-600">{formData.present_days}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Half Day (HD)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.half_days}
                        onChange={(e) => setFormData(p => ({ ...p, half_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-orange-600">{formData.half_days}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Paid Leave (PL)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.paid_leave_days}
                        onChange={(e) => setFormData(p => ({ ...p, paid_leave_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-blue-600">{formData.paid_leave_days}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Absent (AB)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.absent_days}
                        onChange={(e) => setFormData(p => ({ ...p, absent_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-red-600">{formData.absent_days}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Holidays (HO)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.holiday_count}
                        disabled
                        className="mt-1 font-semibold bg-muted"
                        title="Holiday count is auto-calculated from attendance records"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-purple-600">{formData.holiday_count}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Late Days (LD)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.late_days}
                        onChange={(e) => setFormData(p => ({ ...p, late_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-yellow-700">{formData.late_days}</p>
                    )}
                  </div>
                              <div>
                    <Label className="text-xs text-muted-foreground">Leave (LE)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={formData.sick_leaves}
                        onChange={(e) => setFormData(p => ({ ...p, sick_leaves: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-pink-600">{formData.sick_leaves}</p>
                    )}
                  </div>

                                    <div>
                    <Label className="text-xs text-muted-foreground">Late Sets (LS)</Label>
                    {isAdmin && isAttendanceEditable ? (
                      <Input
                        type="number"
                        value={Math.floor(formData.late_days / 3)}
                        disabled
                        className="mt-1 font-semibold bg-muted"
                        title="Auto-calculated: Late Days ÷ 3"
                      />
                    ) : (
                      <p className="font-semibold text-lg text-yellow-700">{Math.floor(formData.late_days / 3)}</p>
                    )}
                  </div>

                </div>
                
    
                
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Total Paid Days:</span>
                    <span className="text-lg font-bold text-primary">
                      {(formData.present_days + formData.holiday_count + (formData.half_days * 0.5) + formData.paid_leave_days - Math.floor(formData.late_days / 3) - formData.absent_days).toFixed(1)} days
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 mb-2 text-right">
                    PR ({formData.present_days}) + HO ({formData.holiday_count}) + HD ({(formData.half_days * 0.5).toFixed(1)}) + PL ({formData.paid_leave_days}) - (Late Sets ({Math.floor(formData.late_days / 3)}) + AB ({formData.absent_days}))
                  </p>
                  
                  {/* Save Button for Attendance Changes */}
                  {isAdmin && isAttendanceEditable && (
                    <div className="mt-4 flex gap-2">
                      <Button 
                        onClick={handleSaveAttendance}
                        disabled={isSubmitting}
                        className="gap-2"
                      >
                        {isSubmitting ? "Saving..." : "Save Attendance"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setIsAttendanceEditable(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
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
                      Auto: {formData.basic_percentage}% of Gross = ₹{calculateSalary().basicEarned.toFixed(2)}
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
                      Auto: {formData.hra_percentage}% of Basic = ₹{calculateSalary().hraEarned.toFixed(2)}
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
                      Auto: {formData.other_allowance_percentage}% of Gross = ₹{calculateSalary().otherAllowanceEarned.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Based Earnings */}
              <div className="space-y-4">
                <h4 className="font-semibold border-b pb-2">Performance Based Earnings</h4>
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
                        ₹{calculateSalary().epfEmployee.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.epf_percentage}% of Basic (₹{calculateSalary().basicEarned.toFixed(2)})
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
                        ₹{calculateSalary().esicEmployee.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.esic_percentage}% of Total Gross (₹{calculateSalary().totalGrossEarnings.toFixed(2)})
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
                  <span className="font-medium">₹{calculateSalary().basicEarned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>HRA ({formData.hra_percentage}% of Basic)</span>
                  <span className="font-medium">₹{calculateSalary().hraEarned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Other Allowance ({formData.other_allowance_percentage}%)</span>
                  <span className="font-medium">₹{calculateSalary().otherAllowanceEarned.toLocaleString()}</span>
                </div>
              </div>

              {/* B. Total Earnings */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>B. Total Earnings</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Fixed Gross (Earned based on attendance)</span>
                  <span className="font-medium">₹{calculateSalary().grossEarned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Performance Based Earnings</span>
                  <span className="font-medium">₹{calculateSalary().totalVariableEarnings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Gross Earnings</span>
                  <span className="text-primary">₹{calculateSalary().totalGrossEarnings.toLocaleString()}</span>
                </div>
              </div>

              {/* C. Employee Deductions */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>C. Employee Deductions</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>EPF Employee</span>
                  <span className="font-medium">₹{calculateSalary().epfEmployee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>ESIC Employee</span>
                  <span className="font-medium">₹{calculateSalary().esicEmployee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Deductions</span>
                  <span className="text-destructive">₹{calculateSalary().totalDeductions.toLocaleString()}</span>
                </div>
              </div>

              {/* D. Net Payable */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-bold text-xl border-t-2 pt-3 text-green-600">
                  <span>D. Net Payable to Employee</span>
                  <span>₹{calculateSalary().netPayable.toLocaleString()}</span>
                </div>
              </div>

              {/* E. Employer Contributions */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>E. Employer Contributions</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>EPF Employer ({formData.epf_percentage}%)</span>
                  <span className="font-medium">₹{calculateSalary().epfEmployer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>ESIC Employer (3.25%)</span>
                  <span className="font-medium">₹{calculateSalary().esicEmployer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Employer Benefit</span>
                  <span>₹{calculateSalary().totalEmployerBenefit.toLocaleString()}</span>
                </div>
              </div>

              {/* F. Total CTC */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-bold text-2xl border-t-2 pt-3 text-primary">
                  <span>F. Total Cost to Company</span>
                  <span>₹{calculateSalary().totalCTC.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Net Payable + Employer Contributions
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
                      formData.net_salary_manual > calculateSalary().netPayable 
                        ? "text-green-600" 
                        : formData.net_salary_manual < calculateSalary().netPayable
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}>
                      {formData.net_salary_manual > calculateSalary().netPayable ? "+" : ""}
                      ₹{(formData.net_salary_manual - calculateSalary().netPayable).toLocaleString()}
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

      {/* Audit History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Salary History - {selectedSalary?.employee_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {auditHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>No changes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditHistory.map((record) => (
                  <div key={record.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="capitalize">{record.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(record.created_at), "MMM dd, yyyy HH:mm")}
                      </span>
                    </div>
                    {record.change_reason && (
                      <p className="text-sm mt-2 text-muted-foreground">{record.change_reason}</p>
                    )}
                    {record.new_data && typeof record.new_data === 'object' && (
                      <div className="mt-2 text-xs">
                        <span className="font-medium">New Net: </span>
                        ₹{((record.new_data as Record<string, unknown>).final_salary as number || 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Confirmation Dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Unlock className="h-5 w-5" />
              Unlock Salary Record
            </DialogTitle>
            <DialogDescription>
              Unlocking will allow editing of this salary record. This action will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <div className="font-medium">{selectedSalary?.employee_name}</div>
            </div>
            <div>
              <Label>Current Net Salary</Label>
              <div className="font-medium">₹{(selectedSalary?.final_salary || 0).toLocaleString()}</div>
            </div>
            <div>
              <Label>Reason for Unlocking (Required)</Label>
              <Textarea
                placeholder="Explain why this salary needs to be unlocked..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnlock} disabled={!unlockReason.trim()}>
              <Unlock className="h-4 w-4 mr-1" />
              Confirm Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip View Dialog */}
      <Dialog open={payslipDialogOpen} onOpenChange={setPayslipDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip - {selectedSalary?.employee_name}
            </DialogTitle>
            <DialogDescription>
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </DialogDescription>
          </DialogHeader>
          {selectedSalary && (
            <PayslipView 
              userId={selectedSalary.user_id} 
              month={selectedSalary.month} 
              year={selectedSalary.year} 
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayslipDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
