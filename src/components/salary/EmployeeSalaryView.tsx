import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Calendar, Clock, Calculator, CheckCircle, Lock, AlertCircle, TrendingUp, TrendingDown, User, Coins } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Potential Earning Dialog Component
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
    
    // Recalculate monthly earning
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
            {/* Table */}
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
                <TrendingUp className="h-4 w-4" />
                Add New Task Type
              </Button>
            )}

            {/* Total */}
            <div className="flex items-center justify-center gap-4 p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
              <span className="text-xl font-semibold">Total Potential Monthly:</span>
              <span className="text-3xl font-bold text-primary">₹{totalPotential.toLocaleString()}</span>
            </div>

            {/* Note */}
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

interface SalaryRecord {
  id: string;
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
  approval_status: string | null;
  is_locked: boolean | null;
  locked_at: string | null;
}

interface EmployeeSalaryViewProps {
  userId: string;
  isAdmin?: boolean;
}

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

export function EmployeeSalaryView({ userId, isAdmin = false }: EmployeeSalaryViewProps) {
  const [salary, setSalary] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Earnings state
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [earningsByType, setEarningsByType] = useState<Record<string, number>>({});
  const [loadingEarnings, setLoadingEarnings] = useState(false);

  const fetchSalary = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("salaries")
        .select("*")
        .eq("user_id", userId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .eq("is_locked", true)
        .maybeSingle();

      if (error) throw error;
      setSalary(data);
    } catch (error) {
      console.error("Error fetching salary:", error);
      toast({
        title: "Error",
        description: "Failed to load salary data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, selectedMonth, selectedYear]);

  const fetchTotalEarnings = useCallback(async () => {
    if (!userId) return;
    
    setLoadingEarnings(true);
    try {
      // Fetch earnings with task details to get type
      const { data, error } = await supabase
        .from("task_earnings" as any)
        .select(`
          amount,
          status,
          task_id,
          tasks!inner(type)
        `)
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching earnings:", error);
        return;
      }

      // Calculate total approved and paid earnings
      const approvedEarnings = (data || [])
        .filter((earning: any) => earning.status === "approved" || earning.status === "paid");
      
      const total = approvedEarnings
        .reduce((sum: number, earning: any) => sum + (parseFloat(earning.amount) || 0), 0);

      // Calculate earnings by type
      const byType: Record<string, number> = {};
      approvedEarnings.forEach((earning: any) => {
        const taskType = earning.tasks?.type || "Unassigned Type";
        byType[taskType] = (byType[taskType] || 0) + parseFloat(earning.amount || 0);
      });

      setTotalEarnings(total);
      setEarningsByType(byType);
    } catch (error) {
      console.error("Error fetching total earnings:", error);
    } finally {
      setLoadingEarnings(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSalary();
    fetchTotalEarnings();
  }, [fetchSalary, fetchTotalEarnings]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const hasManualOverride = salary?.net_salary_manual !== null && salary?.net_salary_manual !== undefined;
  const finalNetSalary = salary?.final_salary || salary?.net_salary_manual || salary?.net_salary_calculated || 0;
  const calculatedNetSalary = salary?.net_salary_calculated || 0;
  const difference = hasManualOverride ? finalNetSalary - calculatedNetSalary : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Tabs defaultValue="salary" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="salary" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Salary
        </TabsTrigger>
        <TabsTrigger value="earnings" className="gap-2">
          <Coins className="h-4 w-4" />
          Earnings
        </TabsTrigger>
      </TabsList>

      {/* Salary Tab */}
      <TabsContent value="salary" className="space-y-6">
      {/* Month/Year Selector and Potential Earning Button */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm font-medium text-muted-foreground">Select Period:</span>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Potential Earning Button */}
            <PotentialEarningDialog isAdmin={isAdmin} />
          </div>
        </CardContent>
      </Card>

      {!salary ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Salary Data Available</h3>
            <p className="text-muted-foreground mt-2">
              Salary for {months.find((m) => m.value === selectedMonth)?.label} {selectedYear} has not been processed yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You can only view salaries that have been locked by the admin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle>Salary Summary</CardTitle>
                </div>
                <Badge className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Finalized
                </Badge>
              </div>
              <CardDescription>
                {months.find((m) => m.value === salary.month)?.label} {salary.year}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{formatCurrency(finalNetSalary)}</div>
              <p className="text-sm text-muted-foreground mt-1">Net Salary (Final)</p>

              {hasManualOverride && (
                <div className="mt-4 p-3 rounded-lg bg-accent/50 border border-accent">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Manager/Admin Override Applied</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-muted-foreground">
                      Auto-calculated: <span className="line-through">{formatCurrency(calculatedNetSalary)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {difference > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={difference > 0 ? "text-green-600" : "text-red-600"}>
                        {difference > 0 ? "+" : ""}
                        {formatCurrency(difference)}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calculation Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Attendance & Working Days */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Attendance Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Working Days</p>
                    <p className="text-2xl font-semibold">{salary.working_days}</p>
                    <p className="text-xs text-muted-foreground">Excl. Sundays & Holidays</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Present Days</p>
                    <p className="text-2xl font-semibold">{salary.present_days || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Paid Leaves</p>
                    <p className="text-2xl font-semibold">{salary.paid_leave_days || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Absent Days</p>
                    <p className="text-2xl font-semibold text-destructive">{salary.absent_days || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Salary Calculation Formula */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Calculation Breakdown</CardTitle>
                </div>
                <CardDescription>How your salary is calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Base Salary</span>
                  <span className="font-medium">{formatCurrency(salary.base_salary)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-muted/30 px-2 rounded">
                  <span className="text-muted-foreground">÷ Working Days</span>
                  <span className="font-medium">{salary.working_days}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground font-medium">Per Day Salary</span>
                  <span className="font-semibold text-primary">{formatCurrency(salary.per_day_salary)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-muted/30 px-2 rounded">
                  <span className="text-muted-foreground">× (Present + Paid Leave)</span>
                  <span className="font-medium">{(salary.present_days || 0) + (salary.paid_leave_days || 0)} days</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t">
                  <span className="text-muted-foreground font-medium">Earned Basic</span>
                  <span className="font-semibold">
                    {formatCurrency((salary.per_day_salary || 0) * ((salary.present_days || 0) + (salary.paid_leave_days || 0)))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Earnings & Deductions */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Earnings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-lg">Earnings</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Basic Earned</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {formatCurrency((salary.per_day_salary || 0) * ((salary.present_days || 0) + (salary.paid_leave_days || 0)))}
                    </span>
                    <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">HRA (Housing)</span>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(salary.hra_amount)}</span>
                    <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Travel Allowance</span>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(salary.travel_allowance)}</span>
                    <Badge variant="outline" className="ml-2 text-xs">Fixed</Badge>
                  </div>
                </div>
                {(salary.special_bonus || 0) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Special Bonus</span>
                    <div className="text-right">
                      <span className="font-medium text-green-600">{formatCurrency(salary.special_bonus)}</span>
                      <Badge className="ml-2 text-xs bg-green-500">Bonus</Badge>
                    </div>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center py-2 font-semibold">
                  <span>Gross Salary</span>
                  <span className="text-green-600">{formatCurrency(salary.gross_salary)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg">Deductions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Provident Fund (PF)</span>
                  <div className="text-right">
                    <span className="font-medium text-red-600">-{formatCurrency(salary.pf_deduction)}</span>
                    <Badge variant="outline" className="ml-2 text-xs">12%</Badge>
                  </div>
                </div>
                {(salary.tds_deduction || 0) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">TDS (Tax)</span>
                    <div className="text-right">
                      <span className="font-medium text-red-600">-{formatCurrency(salary.tds_deduction)}</span>
                      <Badge variant="outline" className="ml-2 text-xs">Tax</Badge>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Professional Tax</span>
                  <div className="text-right">
                    <span className="font-medium text-red-600">-{formatCurrency(salary.professional_tax)}</span>
                    <Badge variant="outline" className="ml-2 text-xs">Fixed</Badge>
                  </div>
                </div>
                {(salary.other_deductions || 0) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Other Deductions</span>
                    <span className="font-medium text-red-600">-{formatCurrency(salary.other_deductions)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center py-2 font-semibold">
                  <span>Total Deductions</span>
                  <span className="text-red-600">
                    -{formatCurrency(
                      (salary.pf_deduction || 0) +
                        (salary.tds_deduction || 0) +
                        (salary.professional_tax || 0) +
                        (salary.other_deductions || 0)
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Final Summary */}
          <Card className="border-2 border-primary/30">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Gross Salary</p>
                  <p className="text-xl font-semibold">{formatCurrency(salary.gross_salary)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Total Deductions</p>
                  <p className="text-xl font-semibold text-red-600">
                    -{formatCurrency(
                      (salary.pf_deduction || 0) +
                        (salary.tds_deduction || 0) +
                        (salary.professional_tax || 0) +
                        (salary.other_deductions || 0)
                    )}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">
                    Net Salary {hasManualOverride ? "(Override)" : "(Calculated)"}
                  </p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(finalNetSalary)}</p>
                  {hasManualOverride && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto: {formatCurrency(calculatedNetSalary)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </TabsContent>

      {/* Earnings Tab */}
      <TabsContent value="earnings" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Total Earnings Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Total Earnings</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTotalEarnings}
                  disabled={loadingEarnings}
                >
                  Refresh
                </Button>
              </div>
              <CardDescription>From completed tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <Skeleton className="h-12 w-32" />
              ) : (
                <>
                  <div className="text-4xl font-bold text-green-600">
                    ₹{totalEarnings.toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Approved & Paid
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Earnings by Type Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Earnings by Type</CardTitle>
              </div>
              <CardDescription>Breakdown by task type</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : Object.keys(earningsByType).length === 0 ? (
                <p className="text-sm text-muted-foreground">No earnings yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(earningsByType).map(([type, amount]) => {
                    const icon = 
                      type === "English Reading, listening & speaking Task" ? "📚" :
                      type === "Lesson Plan & Delivery" ? "📝" :
                      type === "Soft & Digital Skills" ? "💻" :
                      "❓";
                    
                    const displayType = 
                      type === "English Reading, listening & speaking Task" ? "English Reading" :
                      type === "Lesson Plan & Delivery" ? "Lesson Plan" :
                      type === "Soft & Digital Skills" ? "Soft & Digital" :
                      type;

                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{icon}</span>
                          <span className="font-medium text-sm">{displayType}</span>
                        </div>
                        <span className="font-bold text-blue-600">
                          ₹{amount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Earnings Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Task-based Rewards</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Earn money by completing assigned tasks. Each task type has a different reward amount.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Approved Earnings</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Earnings are counted only after your task response is reviewed and approved by admin or peer reviewers.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Coins className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Payment Status</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total earnings shown include both approved and paid amounts. Check individual task status for payment details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
