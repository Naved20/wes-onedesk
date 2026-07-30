import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getPaidDays, getPaidDaysFormula } from "@/lib/paidDays";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Download, AlertCircle, DollarSign, TrendingUp, TrendingDown, Calendar, Calculator } from "lucide-react";
import { generatePayslipPDF } from "./PayslipPDF";
import { PayslipWrapper } from "./PayslipWrapper";

const earningTypeLabels: Record<string, { label: string; description: string; icon: string }> = {
  LESSON_PLAN: {
    label: 'Lesson Plan & Delivery',
    description: 'Complete assigned homework, research and write',
    icon: '',
  },
  ENG_TRAINING: {
    label: 'English Training Tasks',
    description: 'Read, Write, Speak & Record articles',
    icon: '',
  },
  DIGITAL_TRAINING: {
    label: 'Soft & Digital Skills',
    description: 'Complete GT Session tasks',
    icon: '',
  },
  PERFORMANCE_REWARD: {
    label: 'Performance Based Reward',
    description: 'Mentorship sessions and deliverables',
    icon: '',
  },
};

interface SalaryDetail {
  id: string;
  month: number;
  year: number;
  
  // Attendance - All fields from salaries table
  working_days: number;
  present_days: number;
  half_days: number;
  paid_leave_days: number;
  sick_leaves: number;
  absent_days: number;
  late_days: number;
  holiday_count: number;
  
  // Fixed components
  base_salary: number;
  basic_earned: number;
  hra_earned: number;
  other_allowance_earned: number;
  
  // Variable earnings
  variable_earnings_details: Record<string, number>;
  variable_earnings_total: number;
  
  // Deductions
  epf_employee: number;
  esic_employee: number;
  manual_deductions_details: Record<string, number>;
  manual_deductions_total: number;
  total_deductions: number;
  
  // Totals
  gross_salary: number;
  net_salary_calculated: number;
  net_salary_manual: number | null;
  final_salary: number;
  
  // Employer contributions
  epf_employer: number;
  esic_employer: number;
  total_employer_contribution: number;
  total_ctc: number;
  
  // Status
  approval_status: string;
  is_locked: boolean;
  created_at: string;
}

interface PayslipViewProps {
  userId: string;
  month?: number;
  year?: number;
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

// Potential Earnings Dialog Component
function PotentialEarningsDialog() {
  const [earnings, setEarnings] = useState<Array<{
    taskType: string;
    rate: number;
    tasksPerMonth: number;
    monthlyEarning: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("earning_structure")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        taskType: item.task_type,
        rate: Number(item.rate),
        tasksPerMonth: item.tasks_per_month,
        monthlyEarning: Number(item.rate) * item.tasks_per_month,
      }));

      setEarnings(mapped);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      toast({
        title: "Error",
        description: "Failed to load potential earnings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (earnings.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No potential earnings configured
        </AlertDescription>
      </Alert>
    );
  }

  const totalPotential = earnings.reduce((sum, e) => sum + e.monthlyEarning, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-3 text-left font-semibold">Task Type</th>
              <th className="p-3 text-right font-semibold">Rate</th>
              <th className="p-3 text-right font-semibold">Tasks/Month</th>
              <th className="p-3 text-right font-semibold">Monthly Earning</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((earning, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/50">
                <td className="p-3">{earning.taskType}</td>
                <td className="p-3 text-right">₹{earning.rate.toLocaleString()}</td>
                <td className="p-3 text-right">{earning.tasksPerMonth}</td>
                <td className="p-3 text-right font-semibold text-green-600">
                  ₹{earning.monthlyEarning.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Potential Monthly Earnings</span>
          <span className="text-2xl font-bold text-green-600">₹{totalPotential.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function PayslipView({ userId, month: initialMonth, year: initialYear }: PayslipViewProps) {
  const [salary, setSalary] = useState<SalaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear());
  const [employeeInfo, setEmployeeInfo] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch salary details
      const { data: salaryData, error: salaryError } = await supabase
        .from("salaries" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      if (salaryError) throw salaryError;

      if (salaryData) {
        // Fetch attendance stats via RPC (SAME SOURCE AS ATTENDANCE PAGE)
        console.log("✅ Fetching attendance stats via RPC for PayslipView");
        const { data: statsData, error: statsError } = await supabase.rpc('calculate_attendance_stats', {
          p_user_id: userId,
          p_year: selectedYear,
          p_month: selectedMonth,
        });
        
        if (statsError) {
          console.warn("⚠️ Warning: Could not fetch attendance stats via RPC:", statsError);
        }
        
        // Merge RPC attendance data with salary data to ensure fresh data
        const enrichedSalaryData = statsData ? {
          ...salaryData,
          present_days: statsData.present_days,
          half_days: statsData.half_days,
          paid_leave_days: statsData.paid_leave_days,
          sick_leaves: statsData.leave_days,
          absent_days: statsData.absent_days,
          late_days: statsData.late_days,
          holiday_count: statsData.holiday_count,
        } : salaryData;
        
        setSalary(enrichedSalaryData as unknown as SalaryDetail);
      } else {
        setSalary(null);
      }

      // Fetch employee info
      const { data: empData } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (empData) {
        setEmployeeInfo(empData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load payslip",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    await generatePayslipPDF();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!salary) {
    return (
      <div className="space-y-6">
        {/* Month/Year Selector Card */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No salary record found for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const monthLabel = months.find(m => m.value === selectedMonth)?.label;
  const payrollDays = new Date(selectedYear, selectedMonth, 0).getDate();
  const perDayRate = payrollDays > 0 ? salary.base_salary / payrollDays : 0;
  
  // Fallback CTC calculation if not set in database
  // CTC = Net Payable + Employer Contributions
  const calculatedCTC = (salary.final_salary || 0) + (salary.total_employer_contribution || 0);

  return (
    <div className="space-y-4">
      {/* Month/Year Selector Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap items-center justify-between">
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
            <span className="text-sm font-semibold text-primary">
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Controls */}
      <div className="flex gap-2 justify-end print:hidden">
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Potential Earnings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Potential Earnings</DialogTitle>
            </DialogHeader>
            <PotentialEarningsDialog />
          </DialogContent>
        </Dialog>
      </div>

      {/* Payslip Container */}
      <Card className="border-2 print:border-black print:shadow-none">
        <CardContent className="p-4 print:p-2" id="payslip-content">
          <PayslipWrapper>
          {/* Header */}
          <div className="text-center mb-3 pb-3 border-b-2 border-gray-300">
            <h1 className="text-2xl font-bold text-primary mb-1">PAYSLIP</h1>
            <p className="text-gray-600 font-semibold text-sm" data-month-year>{monthLabel} {selectedYear}</p>
            <p className="text-xs text-gray-500">Salary Statement</p>
          </div>

          {/* Employee Info Section */}
          <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b-2 border-gray-300">
            <div>
              <h3 className="font-bold text-xs text-gray-600 mb-1">EMPLOYEE INFORMATION</h3>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-semibold">Name:</span>
                  <span className="ml-2" data-employee-name>{employeeInfo?.first_name} {employeeInfo?.last_name}</span>
                </div>
                <div>
                  <span className="font-semibold">Employee ID:</span>
                  <span className="ml-2">{employeeInfo?.employee_id || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">Designation:</span>
                  <span className="ml-2">{employeeInfo?.designation || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">Department:</span>
                  <span className="ml-2">{employeeInfo?.institution_assignment || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">Email:</span>
                  <span className="ml-2">{employeeInfo?.email || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">Phone:</span>
                  <span className="ml-2">{employeeInfo?.phone || "N/A"}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-xs text-gray-600 mb-1">SALARY PERIOD</h3>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-semibold">Month:</span>
                  <span className="ml-2">{monthLabel} {selectedYear}</span>
                </div>
                <div>
                  <span className="font-semibold">Status:</span>
                  <span className="ml-2">
                    <Badge variant={salary.is_locked ? "default" : "secondary"}>
                      {salary.is_locked ? "Locked" : "Draft"}
                    </Badge>
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Approval:</span>
                  <span className="ml-2">
                    <Badge variant={salary.approval_status === "approved" ? "default" : "outline"}>
                      {salary.approval_status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Date of Joining:</span>
                  <span className="ml-2">{employeeInfo?.date_of_joining ? new Date(employeeInfo.date_of_joining).toLocaleDateString() : "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">PAN Number:</span>
                  <span className="ml-2">{employeeInfo?.pan_number || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold">Bank Account:</span>
                  <span className="ml-2">{employeeInfo?.bank_account_number || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Section - Compact Stats Grid */}
          <div className="mb-3 pb-3 border-b-2 border-gray-300">
            <div className="p-2 rounded-lg border bg-blue-50 border-blue-200">
              <h4 className="font-semibold text-xs mb-2 flex items-center gap-2">
                📅 Attendance Summary (Auto-fetched)
              </h4>
              
              {/* First Row: Payroll Days, Present, Half Day, Paid Leave, Absent */}
              <div className="grid grid-cols-5 gap-2 text-xs mb-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Payroll Days</p>
                  <p className="font-semibold text-sm">{new Date(selectedYear, selectedMonth, 0).getDate()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Present (PR)</p>
                  <p className="font-semibold text-sm text-green-600">{salary.present_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Half Day (HD)</p>
                  <p className="font-semibold text-sm text-orange-600">{salary.half_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Paid Leave (PL)</p>
                  <p className="font-semibold text-sm text-blue-600">{salary.paid_leave_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Absent (AB)</p>
                  <p className="font-semibold text-sm text-red-600">{salary.absent_days}</p>
                </div>
              </div>

              {/* Second Row: Holidays, Late Days, Leave, Late Sets */}
              <div className="grid grid-cols-5 gap-2 text-xs mb-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Holidays (HO)</p>
                  <p className="font-semibold text-sm text-purple-600">{salary.holiday_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Leave (LE)</p>
                  <p className="font-semibold text-sm text-pink-600">{salary.sick_leaves}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Late Days (LT)</p>
                  <p className="font-semibold text-sm text-yellow-700">{salary.late_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Late Sets (LS)</p>
                  <p className="font-semibold text-sm text-yellow-700">{Math.floor(salary.late_days / 3)}</p>
                </div>
                <div></div>
              </div>

              {/* Total Paid Days */}
              <div className="mt-1 pt-1 border-t border-blue-200">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-medium">Total Paid Days:</span>
                  <span className="text-sm font-bold text-primary">
                    {getPaidDays(salary).toFixed(1)} days
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {getPaidDaysFormula(salary)}
                </p>
              </div>
            </div>
          </div>

          {/* Live Calculation Panel - EXACT SAME AS SALARY MANAGEMENT */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-lg">Salary Calculation Breakdown</h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* LEFT: EARNINGS */}
              <div className="flex flex-col h-full space-y-3">
                <h5 className="font-semibold text-sm flex items-center gap-2 text-green-700 dark:text-green-400 border-b pb-2">
                  <TrendingUp className="h-4 w-4" /> Earnings
                </h5>
                
                <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground font-bold">Fixed Salary Structure</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Basic Salary</span>
                      <span className="font-semibold">₹{salary.basic_earned?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>HRA</span>
                      <span className="font-semibold">₹{salary.hra_earned?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Allowance</span>
                      <span className="font-semibold">₹{salary.other_allowance_earned?.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Earnings</span>
                      <span className="text-green-700 dark:text-green-400">₹{((salary.basic_earned || 0) + (salary.hra_earned || 0) + (salary.other_allowance_earned || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {(salary.variable_earnings_total || 0) > 0 && (
                  <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-muted-foreground font-bold">Performance Based Earning</p>
                    <div className="space-y-1 text-sm">
                      {salary.variable_earnings_details &&
                        Object.entries(salary.variable_earnings_details).map(([code, amount]) => {
                          const val = parseFloat(String(amount)) || 0;
                          if (val <= 0) return null;
                          const labelInfo = earningTypeLabels[code] || { label: code.replace(/_/g, ' '), icon: '' };
                          return (
                            <div key={code} className="flex justify-between">
                              <span className="text-muted-foreground">{labelInfo.icon} {labelInfo.label}</span>
                              <span className="font-semibold">₹{val.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      <div className="border-t border-blue-200 dark:border-blue-700 pt-1 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-blue-700 dark:text-blue-400">₹{salary.variable_earnings_total?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-1 py-2 px-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-muted-foreground font-medium"></p>
                  <div className="flex justify-between">
                    <span className="font-bold">Total Earnings</span>
                    <span className="text-lg font-bold text-purple-700 dark:text-purple-400">₹{salary.gross_salary?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* MIDDLE: DEDUCTIONS */}
              <div className="flex flex-col h-full space-y-3">
                <h5 className="font-semibold text-sm flex items-center gap-2 text-red-700 dark:text-red-400 border-b pb-2">
                  <TrendingDown className="h-4 w-4" /> Deductions
                </h5>

                <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-muted-foreground font-bold">Statutory Deductions</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>EPF Employee ({(salary.epf_employee && salary.basic_earned) ? (salary.epf_employee / salary.basic_earned * 100).toFixed(0) : 12}%)</span>
                      <span className="font-semibold">₹{salary.epf_employee?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ESIC Employee (0.75%)</span>
                      <span className="font-semibold">₹{salary.esic_employee?.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-red-700 dark:text-red-400">₹{((salary.epf_employee || 0) + (salary.esic_employee || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {Object.keys(salary.manual_deductions_details || {}).length > 0 && (
                  <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-muted-foreground font-bold">Other Deductions</p>
                    <div className="space-y-1 text-sm">
                      {Object.entries(salary.manual_deductions_details || {}).map(([name, amount]) => (
                        <div key={name} className="flex justify-between">
                          <span>{name}</span>
                          <span className="font-semibold">₹{(parseFloat(amount as any) || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-1 py-2 px-3 bg-red-100 dark:bg-red-900/30 rounded-lg border-2 border-red-300 dark:border-red-700">
                  <p className="text-xs text-muted-foreground font-medium"></p>
                  <div className="flex justify-between">
                    <span className="font-bold">Total Deductions</span>
                    <span className="text-lg font-bold text-red-700 dark:text-red-400">₹{salary.total_deductions?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: NET PAYABLE & CTC */}
              <div className="flex flex-col h-full space-y-3">
                <h5 className="font-semibold text-sm border-b pb-2">Summary</h5>

                {/* Net Payable - LARGEST CARD */}
                <div className="space-y-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 rounded-lg border-3 border-green-400 dark:border-green-600 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <p className="text-xs font-bold text-green-900 dark:text-green-200 uppercase tracking-wide">Your Net Salary</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Earnings</span>
                      <span>₹{salary.gross_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span className="text-muted-foreground">(-) Deductions</span>
                      <span>₹{salary.total_deductions?.toLocaleString()}</span>
                    </div>
                    <div className="border-t-2 border-green-300 dark:border-green-700 pt-2 flex justify-between">
                      <span className="font-bold text-lg">Net Salary</span>
                      <span className="text-2xl font-bold text-green-700 dark:text-green-300">₹{salary.final_salary?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Employer Contribution */}
                <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-muted-foreground font-bold">Employer Statutory Contribution (Not in your salary) Deposited into your PF Account</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Employer EPF</span>
                      <span className="font-semibold">₹{salary.epf_employer?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Employer ESIC</span>
                      <span className="font-semibold">₹{salary.esic_employer?.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Total Benefit</span>
                      <span className="text-amber-700 dark:text-amber-400">₹{salary.total_employer_contribution?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* CTC */}
                <div className="mt-auto space-y-2 p-3 bg-slate-900 dark:bg-slate-950 rounded-lg border-2 border-slate-700 text-white">
                  <p className="text-xs font-medium uppercase tracking-wide opacity-75">Cost to Company</p>
                  <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total CTC</span>
                    <span className="text-xl font-bold text-yellow-400">₹{((salary.final_salary || 0) + (salary.total_employer_contribution || 0)).toLocaleString()}</span>
                  </div>
                  <p className="text-xs opacity-75 mt-2">
                    = Net Salary + Employer Contribution
                  </p>
                </div>
              </div>
            </div>
          </div>



          {/* Notes and Signature Section */}
          <div className="mt-8 space-y-6 border-t-4 border-yellow-400 pt-6">
            {/* Important Notes */}
            <div className="space-y-3">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">Note:</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Employee EPF contribution is deducted from monthly earnings but deposited into the employee's PF account as long-term savings.</li>
                  <li>• Employer EPF and ESIC contributions are paid additionally by WES and are not deducted from the employee's salary.</li>
                </ul>
              </div>

              <p className="text-sm text-gray-700">
                This payslip is generated based on attendance, approved earnings, applicable statutory contributions, and deductions for the salary month mentioned above.
              </p>
            </div>


            {/* Generated Footer */}
            <div className="text-center text-xs text-gray-500 pt-8 border-t border-gray-300">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p className="mt-1">For any queries regarding your salary, please contact the HR department.</p>
              <p className="mt-3 text-gray-400">Generated on {format(new Date(), "dd MMM yyyy")}</p>
            </div>
          </div>
          </PayslipWrapper>
        </CardContent>
      </Card>
    </div>
  );
}
