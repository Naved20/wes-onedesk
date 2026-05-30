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
  
  // Attendance
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  absent_days: number;
  
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
  const perDayRate = salary.working_days > 0 ? salary.base_salary / salary.working_days : 0;
  
  // Fallback CTC calculation if not set in database
  // CTC = Net Payable + Employer Contributions
  const calculatedCTC = (salary.net_salary || 0) + (salary.total_employer_contribution || 0);

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

          {/* Attendance Section */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Attendance Details</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-gray-600 font-semibold">Working Days</p>
                <p className="text-2xl font-bold text-blue-600">{salary.working_days}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-gray-600 font-semibold">Present Days</p>
                <p className="text-2xl font-bold text-green-600">{salary.present_days}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-xs text-gray-600 font-semibold">Paid Leaves</p>
                <p className="text-2xl font-bold text-purple-600">{salary.paid_leave_days}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-gray-600 font-semibold">Absent Days</p>
                <p className="text-2xl font-bold text-red-600">{salary.absent_days}</p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-gray-100 rounded-lg flex justify-between">
              <span className="font-semibold">Total Paid Days:</span>
              <span className="font-bold text-lg">{salary.present_days + salary.paid_leave_days} days</span>
            </div>
          </div>

          {/* Earnings Section */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Earnings</h3>
            
            {/* Fixed Salary Structure */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Fixed Salary Structure</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>Fixed Gross Salary (Monthly)</span>
                  <span className="font-semibold">₹{salary.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2">
                  <span>Per Day Rate (₹{salary.base_salary.toLocaleString()} ÷ {salary.working_days} days)</span>
                  <span className="font-semibold">₹{perDayRate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-2">
                  <span>Effective Days ({salary.present_days} present + {salary.paid_leave_days} leaves)</span>
                  <span className="font-semibold">{salary.present_days + salary.paid_leave_days} days</span>
                </div>
                <div className="flex justify-between p-2 bg-blue-50 rounded font-semibold">
                  <span>Gross Earned (Per Day × Effective Days)</span>
                  <span>₹{salary.gross_salary.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Fixed Components */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Fixed Components</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 border-l-4 border-blue-500">
                  <span>Basic Salary (Earned)</span>
                  <span className="font-semibold">₹{salary.basic_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 border-l-4 border-green-500">
                  <span>HRA (Earned)</span>
                  <span className="font-semibold">₹{salary.hra_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 border-l-4 border-purple-500">
                  <span>Other Allowance (Earned)</span>
                  <span className="font-semibold">₹{salary.other_allowance_earned.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Performance Based Earnings */}
            {salary.variable_earnings_total > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Performance Based Earnings</p>
                <div className="space-y-2 text-sm">
                  {Object.entries(salary.variable_earnings_details || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-2 border-l-4 border-green-400">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-semibold">₹{Number(value).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between p-2 bg-green-50 rounded font-semibold">
                    <span>Total Performance Based Earnings</span>
                    <span>₹{salary.variable_earnings_total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Total Gross */}
            <div className="p-3 bg-gradient-to-r from-green-100 to-green-50 rounded-lg border-2 border-green-500">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">TOTAL GROSS EARNINGS</span>
                <span className="text-2xl font-bold text-green-600">₹{salary.gross_salary.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Deductions Section */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Deductions</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 border-l-4 border-red-500">
                <span>EPF (Employee Provident Fund)</span>
                <span className="font-semibold text-red-600">-₹{salary.epf_employee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2 border-l-4 border-red-500">
                <span>ESIC (Employee State Insurance)</span>
                <span className="font-semibold text-red-600">-₹{salary.esic_employee.toLocaleString()}</span>
              </div>
              {salary.manual_deduction > 0 && (
                <div className="flex justify-between p-2 border-l-4 border-red-500">
                  <span>Manual Deduction</span>
                  <span className="font-semibold text-red-600">-₹{salary.manual_deduction.toLocaleString()}</span>
                </div>
              )}
              {salary.tds_deduction > 0 && (
                <div className="flex justify-between p-2 border-l-4 border-red-500">
                  <span>TDS (Tax Deducted at Source)</span>
                  <span className="font-semibold text-red-600">-₹{salary.tds_deduction.toLocaleString()}</span>
                </div>
              )}
              {salary.professional_tax > 0 && (
                <div className="flex justify-between p-2 border-l-4 border-red-500">
                  <span>Professional Tax</span>
                  <span className="font-semibold text-red-600">-₹{salary.professional_tax.toLocaleString()}</span>
                </div>
              )}
              {salary.other_deductions > 0 && (
                <div className="flex justify-between p-2 border-l-4 border-red-500">
                  <span>Other Deductions</span>
                  <span className="font-semibold text-red-600">-₹{salary.other_deductions.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between p-3 bg-red-50 rounded-lg font-bold border-2 border-red-300">
                <span>TOTAL DEDUCTIONS</span>
                <span className="text-red-600">-₹{salary.total_deductions.toLocaleString()}</span>
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

          {/* Employer Contributions Section */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Employer Contributions (Not Deducted from Your Salary)</h3>
            <p className="text-xs text-gray-500 mb-3">These are benefits provided by the company on your behalf</p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 border-l-4 border-green-500">
                <span>EPF Employer Contribution</span>
                <span className="font-semibold text-green-600">+₹{salary.epf_employer.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2 border-l-4 border-green-500">
                <span>ESIC Employer Contribution</span>
                <span className="font-semibold text-green-600">+₹{salary.esic_employer.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-green-50 rounded-lg font-bold border-2 border-green-300">
                <span>TOTAL EMPLOYER CONTRIBUTION</span>
                <span className="text-green-600">+₹{salary.total_employer_contribution.toLocaleString()}</span>
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
                  <span>₹{salary.net_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Employer Contributions</span>
                  <span>+₹{salary.total_employer_contribution.toLocaleString()}</span>
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

          {/* Detailed Breakdown Table */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Detailed Salary Breakdown</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="text-left p-3 font-bold">Description</th>
                    <th className="text-right p-3 font-bold">Amount</th>
                    <th className="text-right p-3 font-bold">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Earnings Section */}
                  <tr className="bg-green-50 font-bold">
                    <td colSpan={3} className="p-3 border-t-2 border-green-300">EARNINGS</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Fixed Gross Salary</td>
                    <td className="text-right p-3 font-semibold">₹{salary.base_salary.toLocaleString()}</td>
                    <td className="text-right p-3">100%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">Basic Salary (Earned)</td>
                    <td className="text-right p-3 font-semibold">₹{salary.basic_earned.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.basic_earned / salary.gross_salary) * 100).toFixed(1)}%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">HRA (Earned)</td>
                    <td className="text-right p-3 font-semibold">₹{salary.hra_earned.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.hra_earned / salary.gross_salary) * 100).toFixed(1)}%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">Other Allowance (Earned)</td>
                    <td className="text-right p-3 font-semibold">₹{salary.other_allowance_earned.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.other_allowance_earned / salary.gross_salary) * 100).toFixed(1)}%</td>
                  </tr>
                  {salary.variable_earnings_total > 0 && (
                    <tr className="border-b">
                      <td className="p-3 pl-6">Performance Based Earnings</td>
                      <td className="text-right p-3 font-semibold text-green-600">₹{salary.variable_earnings_total.toLocaleString()}</td>
                      <td className="text-right p-3">{((salary.variable_earnings_total / salary.gross_salary) * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                  <tr className="bg-green-100 font-bold border-b-2 border-green-300">
                    <td className="p-3">Total Gross Earnings</td>
                    <td className="text-right p-3">₹{salary.gross_salary.toLocaleString()}</td>
                    <td className="text-right p-3">100%</td>
                  </tr>

                  {/* Deductions Section */}
                  <tr className="bg-red-50 font-bold">
                    <td colSpan={3} className="p-3 border-t-2 border-red-300">DEDUCTIONS</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">EPF (Employee Provident Fund)</td>
                    <td className="text-right p-3 font-semibold text-red-600">-₹{salary.epf_employee.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.epf_employee / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">ESIC (Employee State Insurance)</td>
                    <td className="text-right p-3 font-semibold text-red-600">-₹{salary.esic_employee.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.esic_employee / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>
                  {salary.manual_deduction > 0 && (
                    <tr className="border-b">
                      <td className="p-3">Manual Deduction</td>
                      <td className="text-right p-3 font-semibold text-red-600">-₹{salary.manual_deduction.toLocaleString()}</td>
                      <td className="text-right p-3">{((salary.manual_deduction / salary.gross_salary) * 100).toFixed(2)}%</td>
                    </tr>
                  )}
                  {salary.tds_deduction > 0 && (
                    <tr className="border-b">
                      <td className="p-3">TDS (Tax Deducted at Source)</td>
                      <td className="text-right p-3 font-semibold text-red-600">-₹{salary.tds_deduction.toLocaleString()}</td>
                      <td className="text-right p-3">{((salary.tds_deduction / salary.gross_salary) * 100).toFixed(2)}%</td>
                    </tr>
                  )}
                  {salary.professional_tax > 0 && (
                    <tr className="border-b">
                      <td className="p-3">Professional Tax</td>
                      <td className="text-right p-3 font-semibold text-red-600">-₹{salary.professional_tax.toLocaleString()}</td>
                      <td className="text-right p-3">{((salary.professional_tax / salary.gross_salary) * 100).toFixed(2)}%</td>
                    </tr>
                  )}
                  {salary.other_deductions > 0 && (
                    <tr className="border-b">
                      <td className="p-3">Other Deductions</td>
                      <td className="text-right p-3 font-semibold text-red-600">-₹{salary.other_deductions.toLocaleString()}</td>
                      <td className="text-right p-3">{((salary.other_deductions / salary.gross_salary) * 100).toFixed(2)}%</td>
                    </tr>
                  )}
                  <tr className="bg-red-100 font-bold border-b-2 border-red-300">
                    <td className="p-3">Total Deductions</td>
                    <td className="text-right p-3 text-red-600">-₹{salary.total_deductions.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.total_deductions / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>

                  {/* Net Salary */}
                  <tr className="bg-blue-100 font-bold border-b-2 border-blue-300">
                    <td className="p-3">Net Salary (Take Home)</td>
                    <td className="text-right p-3 text-blue-600">₹{salary.final_salary.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.final_salary / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>

                  {/* Employer Contributions */}
                  <tr className="bg-green-50 font-bold">
                    <td colSpan={3} className="p-3 border-t-2 border-green-300">EMPLOYER CONTRIBUTIONS (Not Deducted)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">EPF Employer Contribution</td>
                    <td className="text-right p-3 font-semibold text-green-600">+₹{salary.epf_employer.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.epf_employer / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">ESIC Employer Contribution</td>
                    <td className="text-right p-3 font-semibold text-green-600">+₹{salary.esic_employer.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.esic_employer / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>
                  <tr className="bg-green-100 font-bold border-b-2 border-green-300">
                    <td className="p-3">Total Employer Contribution</td>
                    <td className="text-right p-3 text-green-600">+₹{salary.total_employer_contribution.toLocaleString()}</td>
                    <td className="text-right p-3">{((salary.total_employer_contribution / salary.gross_salary) * 100).toFixed(2)}%</td>
                  </tr>

                  {/* CTC */}
                  <tr className="bg-gradient-to-r from-primary/20 to-primary/10 font-bold border-t-2 border-primary">
                    <td className="p-3">Total Cost to Company (CTC)</td>
                    <td className="text-right p-3 text-primary">₹{calculatedCTC.toLocaleString()}</td>
                    <td className="text-right p-3">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Table */}
          <div className="mb-8 pb-6 border-b-2 border-gray-300">
            <h3 className="font-bold text-sm text-gray-600 mb-4 uppercase">Quick Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span>Gross Earnings</span>
                <span className="font-semibold">₹{salary.gross_salary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2 bg-red-50 rounded">
                <span>Total Deductions</span>
                <span className="font-semibold text-red-600">-₹{salary.total_deductions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2 bg-blue-50 rounded font-bold border-2 border-blue-300">
                <span>Net Salary (Take Home)</span>
                <span className="text-blue-600">₹{salary.final_salary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>Employer Contributions</span>
                <span className="font-semibold text-green-600">+₹{salary.total_employer_contribution.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg font-bold border-2 border-primary">
                <span>Total CTC</span>
                <span className="text-primary">₹{calculatedCTC.toLocaleString()}</span>
              </div>
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
