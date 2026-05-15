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
import { DollarSign, Lock, Unlock, Download, CheckCircle, Clock, AlertCircle, Calculator, RefreshCw, Plus, History, TrendingUp, Coins } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [unlockReason, setUnlockReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      
      // 4. Set form data with all values
      setFormData({
        // From salary_structures
        fixed_gross_salary: (structure as any)?.fixed_gross_salary || salary.base_salary || 0,
        basic_percentage: (structure as any)?.basic_percentage || 50,
        hra_percentage: (structure as any)?.hra_percentage || 40,
        other_allowance_percentage: (structure as any)?.other_allowance_percentage || 30,
        
        // Attendance (auto-calculated)
        working_days: salary.working_days || 26,
        present_days: attendanceSummary.presentDays,
        paid_leave_days: attendanceSummary.paidLeaveDays,
        absent_days: attendanceSummary.absentDays,
        
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

  const openUnlockDialog = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setUnlockReason("");
    setUnlockDialogOpen(true);
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
              {/* Attendance Summary - Editable for Admin */}
              <div className={`p-4 rounded-lg border ${isAdmin ? 'bg-amber-50 dark:bg-amber-950 border-amber-200' : 'bg-blue-50 dark:bg-blue-950 border-blue-200'}`}>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Attendance Summary {isAdmin ? '(Editable)' : '(Auto-fetched)'}
                </h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Working Days</Label>
                    {isAdmin ? (
                      <Input
                        type="number"
                        value={formData.working_days}
                        onChange={(e) => setFormData(p => ({ ...p, working_days: Number(e.target.value) }))}
                        className="mt-1 font-semibold"
                      />
                    ) : (
                      <p className="font-semibold text-lg">{formData.working_days}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Present Days</Label>
                    {isAdmin ? (
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
                    <Label className="text-xs text-muted-foreground">Paid Leaves</Label>
                    {isAdmin ? (
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
                    <Label className="text-xs text-muted-foreground">Absent Days</Label>
                    {isAdmin ? (
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
                </div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: isAdmin ? '#fcd34d' : '#93c5fd' }}>
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
                  <span>Variable Earnings</span>
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
    </div>
  );
}
