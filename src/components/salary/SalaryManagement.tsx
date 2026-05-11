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
  hra_amount: number | null;
  travel_allowance: number | null;
  special_bonus: number | null;
  pf_deduction: number | null;
  tds_deduction: number | null;
  professional_tax: number | null;
  other_deductions: number | null;
  gross_salary: number | null;
  net_salary_calculated: number | null;
  net_salary_manual: number | null;
  final_salary: number | null;
  manager_proposed_salary: number | null;
  manager_justification: string | null;
  approval_status: string | null;
  is_locked: boolean | null;
  locked_at: string | null;
  created_at: string;
  employee_name?: string;
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

  // Form state
  const [formData, setFormData] = useState({
    base_salary: 0,
    working_days: 0,
    present_days: 0,
    paid_leave_days: 0,
    hra_amount: 0,
    travel_allowance: 0,
    special_bonus: 0,
    pf_deduction: 0,
    tds_deduction: 0,
    professional_tax: 0,
    other_deductions: 0,
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

  // Live calculation based on form data
  const calculateSalary = useCallback(() => {
    const perDaySalary = formData.working_days > 0 ? formData.base_salary / formData.working_days : 0;
    const effectiveDays = formData.present_days + formData.paid_leave_days;
    const basicEarned = perDaySalary * effectiveDays;
    const grossSalary = basicEarned + formData.hra_amount + formData.travel_allowance + formData.special_bonus;
    const totalDeductions = formData.pf_deduction + formData.tds_deduction + formData.professional_tax + formData.other_deductions;
    const netSalary = grossSalary - totalDeductions;

    return {
      per_day_salary: Math.round(perDaySalary * 100) / 100,
      basic_earned: Math.round(basicEarned * 100) / 100,
      gross_salary: Math.round(grossSalary * 100) / 100,
      total_deductions: Math.round(totalDeductions * 100) / 100,
      net_salary_calculated: Math.round(netSalary * 100) / 100,
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

  const openEditDialog = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setFormData({
      base_salary: salary.base_salary || 0,
      working_days: salary.working_days || 0,
      present_days: salary.present_days || 0,
      paid_leave_days: salary.paid_leave_days || 0,
      hra_amount: salary.hra_amount || 0,
      travel_allowance: salary.travel_allowance || 0,
      special_bonus: salary.special_bonus || 0,
      pf_deduction: salary.pf_deduction || 0,
      tds_deduction: salary.tds_deduction || 0,
      professional_tax: salary.professional_tax || 0,
      other_deductions: salary.other_deductions || 0,
      net_salary_manual: salary.net_salary_manual,
      manager_justification: salary.manager_justification || "",
    });
    setEditDialogOpen(true);
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
        base_salary: formData.base_salary,
        working_days: formData.working_days,
        present_days: formData.present_days,
        paid_leave_days: formData.paid_leave_days,
        per_day_salary: calculated.per_day_salary,
        hra_amount: formData.hra_amount,
        travel_allowance: formData.travel_allowance,
        special_bonus: formData.special_bonus,
        pf_deduction: formData.pf_deduction,
        tds_deduction: formData.tds_deduction,
        professional_tax: formData.professional_tax,
        other_deductions: formData.other_deductions,
        gross_salary: calculated.gross_salary,
        net_salary_calculated: calculated.net_salary_calculated,
        net_salary_manual: formData.net_salary_manual,
        final_salary: formData.net_salary_manual || calculated.net_salary_calculated,
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
        description: isAdmin && formData.net_salary_manual 
          ? "Salary updated and approved" 
          : "Salary record updated successfully",
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
        <TabsList>
          <TabsTrigger value="all">All Salaries</TabsTrigger>
          {isAdmin && pendingApprovals.length > 0 && (
            <TabsTrigger value="pending" className="relative">
              Pending Approval
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-500 text-white">
                {pendingApprovals.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

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
              ) : salaryRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No salary records for this period</p>
                  <Button variant="outline" className="mt-4" onClick={generateMonthlySalaries} disabled={generating}>
                    {generating ? "Generating..." : "Generate Salary Records"}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Base Salary</TableHead>
                        <TableHead className="text-right">Working Days</TableHead>
                        <TableHead className="text-right">Present</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryRecords.map((salary) => (
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Edit Salary - {selectedSalary?.employee_name}
            </DialogTitle>
            <DialogDescription>
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear} | {isAdmin ? "Full Admin Access" : "Manager Edit"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Earnings</h4>
              <div className="space-y-3">
                <div>
                  <Label>Base Salary</Label>
                  <Input
                    type="number"
                    value={formData.base_salary}
                    onChange={(e) => setFormData(p => ({ ...p, base_salary: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Working Days</Label>
                    <Input
                      type="number"
                      value={formData.working_days}
                      onChange={(e) => setFormData(p => ({ ...p, working_days: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Present Days</Label>
                    <Input
                      type="number"
                      value={formData.present_days}
                      onChange={(e) => setFormData(p => ({ ...p, present_days: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Paid Leave Days</Label>
                  <Input
                    type="number"
                    value={formData.paid_leave_days}
                    onChange={(e) => setFormData(p => ({ ...p, paid_leave_days: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>HRA Amount</Label>
                  <Input
                    type="number"
                    value={formData.hra_amount}
                    onChange={(e) => setFormData(p => ({ ...p, hra_amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Travel Allowance</Label>
                  <Input
                    type="number"
                    value={formData.travel_allowance}
                    onChange={(e) => setFormData(p => ({ ...p, travel_allowance: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Special Bonus</Label>
                  <Input
                    type="number"
                    value={formData.special_bonus}
                    onChange={(e) => setFormData(p => ({ ...p, special_bonus: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* Deductions Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Deductions</h4>
              <div className="space-y-3">
                <div>
                  <Label>PF Deduction (12%)</Label>
                  <Input
                    type="number"
                    value={formData.pf_deduction}
                    onChange={(e) => setFormData(p => ({ ...p, pf_deduction: Number(e.target.value) }))}
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

              {/* Live Calculation Preview */}
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Live Calculation</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Per Day Salary:</span>
                  <span className="font-medium">₹{calculated.per_day_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Basic Earned:</span>
                  <span className="font-medium">₹{calculated.basic_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gross Salary:</span>
                  <span className="font-medium">₹{calculated.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Deductions:</span>
                  <span className="font-medium text-destructive">-₹{calculated.total_deductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Calculated Net:</span>
                  <span className="text-green-600">₹{calculated.net_salary_calculated.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Net Salary Input - Both Admin and Manager */}
          <div className="border-t pt-4 space-y-4">
            <div className="p-4 border rounded-lg bg-primary/5">
              <Label className="text-base font-semibold">Direct Net Salary Input</Label>
              <p className="text-xs text-muted-foreground mb-3">
                {isAdmin 
                  ? "As admin, entering a value here will override calculations and auto-approve"
                  : "Enter the final net salary you want to set (will be submitted for admin approval)"}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-lg">₹</span>
                <Input
                  type="number"
                  className="text-lg font-semibold"
                  placeholder="Enter net salary"
                  value={formData.net_salary_manual || ""}
                  onChange={(e) => setFormData(p => ({ ...p, net_salary_manual: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
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

            {formData.net_salary_manual && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Difference from Calculated:</span>
                  <span className={`font-semibold ${
                    formData.net_salary_manual > calculated.net_salary_calculated 
                      ? "text-green-600" 
                      : formData.net_salary_manual < calculated.net_salary_calculated
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}>
                    {formData.net_salary_manual > calculated.net_salary_calculated ? "+" : ""}
                    ₹{(formData.net_salary_manual - calculated.net_salary_calculated).toLocaleString()}
                  </span>
                </div>
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
