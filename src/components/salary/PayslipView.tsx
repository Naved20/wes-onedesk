import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Download, AlertCircle, DollarSign, TrendingUp } from "lucide-react";
import { generatePayslipPDF } from "./PayslipPDF";

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
  manual_deduction: number;
  tds_deduction: number;
  professional_tax: number;
  other_deductions: number;
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
        setSalary(salaryData as SalaryDetail);
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
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No salary record found for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </AlertDescription>
      </Alert>
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
        <CardContent className="p-8 print:p-4" id="payslip-content">
          {/* Header */}
          <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
            <h1 className="text-3xl font-bold text-primary mb-2">PAYSLIP</h1>
            <p className="text-gray-600 font-semibold" data-month-year>{monthLabel} {selectedYear}</p>
            <p className="text-sm text-gray-500">Salary Statement</p>
          </div>

          {/* Employee Info Section */}
          <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b-2 border-gray-300">
            <div>
              <h3 className="font-bold text-sm text-gray-600 mb-3">EMPLOYEE INFORMATION</h3>
              <div className="space-y-2 text-sm">
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
              <h3 className="font-bold text-sm text-gray-600 mb-3">SALARY PERIOD</h3>
              <div className="space-y-2 text-sm">
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
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                📅 Attendance Summary (Auto-fetched)
              </h4>
              
              {/* First Row: Payroll Days, Present, Half Day, Paid Leave, Absent */}
              <div className="grid grid-cols-5 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Payroll Days</p>
                  <p className="font-semibold text-lg">{new Date(selectedYear, selectedMonth, 0).getDate()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Present (PR)</p>
                  <p className="font-semibold text-lg text-green-600">{salary.present_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Half Day (HD)</p>
                  <p className="font-semibold text-lg text-orange-600">{salary.half_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Paid Leave (PL)</p>
                  <p className="font-semibold text-lg text-blue-600">{salary.paid_leave_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Absent (AB)</p>
                  <p className="font-semibold text-lg text-red-600">{salary.absent_days}</p>
                </div>
              </div>

              {/* Second Row: Holidays, Late Days, Leave, Late Sets */}
              <div className="grid grid-cols-5 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Holidays (HO)</p>
                  <p className="font-semibold text-lg text-purple-600">{salary.holiday_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Late Days (LD)</p>
                  <p className="font-semibold text-lg text-yellow-700">{salary.late_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Leave (LE)</p>
                  <p className="font-semibold text-lg text-pink-600">{salary.sick_leaves}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Late Sets (LS)</p>
                  <p className="font-semibold text-lg text-yellow-700">{Math.floor(salary.late_days / 3)}</p>
                </div>
                <div></div>
              </div>

              {/* Total Paid Days */}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Total Paid Days:</span>
                  <span className="text-lg font-bold text-primary">
                    {(
                      salary.present_days + 
                      salary.holiday_count + 
                      (salary.half_days * 0.5) + 
                      salary.paid_leave_days - 
                      Math.floor(salary.late_days / 3) - 
                      salary.absent_days
                    ).toFixed(1)} days
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  PR ({salary.present_days}) + HO ({salary.holiday_count}) + HD ({(salary.half_days * 0.5).toFixed(1)}) + PL ({salary.paid_leave_days}) - (Late Sets ({Math.floor(salary.late_days / 3)}) + AB ({salary.absent_days}))
                </p>
              </div>
            </div>
          </div>

          {/* Earnings Section - Compact Grid Layout */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                💰 Earnings Summary (Compact View)
              </h4>
              
              {/* First Row: Basic, HRA, Other Allowance, Variable Earnings */}
              <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Basic Salary (Earned)</p>
                  <p className="font-semibold text-lg text-blue-600">₹{salary.basic_earned.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">HRA (Earned)</p>
                  <p className="font-semibold text-lg text-green-600">₹{salary.hra_earned.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Other Allowance (Earned)</p>
                  <p className="font-semibold text-lg text-purple-600">₹{salary.other_allowance_earned.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Variable Earnings</p>
                  <p className="font-semibold text-lg text-green-700">₹{salary.variable_earnings_total.toLocaleString()}</p>
                </div>
              </div>

              {/* Total Gross - Full Width */}
              <div className="mt-4 pt-3 border-t border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Gross Earnings:</span>
                  <span className="text-2xl font-bold text-green-600">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
              </div>

              {/* Formula breakdown in smaller text */}
              <div className="mt-3 p-2 bg-yellow-50 rounded border-l-2 border-yellow-500">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Formula:</span> Per Day Rate = Fixed Gross ÷ Payroll Days | Gross Earned = Per Day Rate × Total Paid Days
                </p>
              </div>
            </div>
          </div>

          {/* Deductions Section - Compact Grid Layout */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <div className="p-4 rounded-lg border bg-red-50 border-red-200">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                🚫 Deductions Summary (Compact View)
              </h4>
              
              {/* First Row: EPF, ESIC, Manual, TDS */}
              <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">EPF (Employee)</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.epf_employee.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">ESIC (Employee)</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.esic_employee.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Manual Deduction</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.manual_deduction.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">TDS</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.tds_deduction.toLocaleString()}</p>
                </div>
              </div>

              {/* Second Row: Professional Tax, Other Deductions, Total Deductions */}
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Professional Tax</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.professional_tax.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Other Deductions</p>
                  <p className="font-semibold text-lg text-red-600">₹{salary.other_deductions.toLocaleString()}</p>
                </div>
                <div className="bg-red-100 rounded p-2">
                  <p className="text-xs text-muted-foreground font-medium">Total Deductions</p>
                  <p className="font-bold text-lg text-red-700">₹{salary.total_deductions.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary Section */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <div className="p-4 bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg border-2 border-blue-500">
              <p className="text-xs font-semibold text-gray-600 mb-2">NET SALARY (Take Home Pay)</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-700">
                    Gross Earnings: <span className="font-semibold">₹{salary.gross_salary.toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    Less: Deductions: <span className="font-semibold">-₹{salary.total_deductions.toLocaleString()}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 mb-1">Amount in your bank account</p>
                  <p className="text-3xl font-bold text-blue-600">₹{salary.final_salary.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employer Contributions Section - Compact */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                🏢 Employer Contributions (Not Deducted from Your Salary)
              </h4>
              
              {/* Contributions Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">EPF Employer</p>
                  <p className="font-semibold text-lg text-green-600">₹{salary.epf_employer.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">ESIC Employer</p>
                  <p className="font-semibold text-lg text-green-600">₹{salary.esic_employer.toLocaleString()}</p>
                </div>
              </div>

              {/* Total Employer Contribution */}
              <div className="pt-2 border-t border-green-200">
                <p className="text-xs text-gray-500 mb-2">These are benefits provided by the company on your behalf</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Employer Contribution:</span>
                  <span className="text-xl font-bold text-green-600">₹{salary.total_employer_contribution.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTC Section */}
          <div className="mb-8">
            <div className="p-6 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg border-2 border-primary">
              <p className="text-xs font-semibold mb-2 opacity-90">TOTAL COST TO COMPANY (CTC)</p>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span>Net Payable to Employee</span>
                  <span>₹{(salary.final_salary || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Employer Contributions</span>
                  <span>+₹{(salary.total_employer_contribution || 0).toLocaleString()}</span>
                </div>
              </div>
              <Separator className="bg-white/30 mb-4" />
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Your Total CTC</span>
                <span className="text-4xl font-bold">₹{calculatedCTC.toLocaleString()}</span>
              </div>
              <p className="text-xs mt-3 opacity-90">
                This is the total value of your compensation package including salary and employer benefits
              </p>
            </div>
          </div>



          {/* Footer */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-300">
            <p>This is a computer-generated payslip and does not require a signature.</p>
            <p className="mt-2">For any queries regarding your salary, please contact the HR department.</p>
            <p className="mt-4 text-gray-400">Generated on {format(new Date(), "dd MMM yyyy")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
