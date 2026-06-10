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
        setSalary(salaryData as unknown as SalaryDetail);
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
                  <p className="text-xs text-muted-foreground font-medium">Leave (LE)</p>
                  <p className="font-semibold text-lg text-pink-600">{salary.sick_leaves}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Late Days (LT)</p>
                  <p className="font-semibold text-lg text-yellow-700">{salary.late_days}</p>
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
                  PR ({salary.present_days}) + HO ({salary.holiday_count}) + HD ({(salary.half_days * 0.5).toFixed(1)}) + PL ({salary.paid_leave_days}) - Late Sets ({Math.floor(salary.late_days / 3)}) - AB ({salary.absent_days})
                </p>
              </div>
            </div>
          </div>

          {/* Payslip as Live Calculation Format */}
          <div className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg border-2 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-lg">Salary Breakdown - {monthLabel} {selectedYear}</h4>
            </div>
            
            <div className="space-y-3">
              {/* A. Fixed Salary Structure */}
              <div className="space-y-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>A. Fixed Salary Structure</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Basic Salary (Earned)</span>
                  <span className="font-medium">₹{salary.basic_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>HRA (Earned)</span>
                  <span className="font-medium">₹{salary.hra_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Other Allowance (Earned)</span>
                  <span className="font-medium">₹{salary.other_allowance_earned.toLocaleString()}</span>
                </div>
              </div>

              {/* B. Fixed Earnings (Gross Salary) */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>B. Fixed Earnings (Gross Salary)</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Fixed Gross (Earned based on attendance)</span>
                  <span className="font-medium">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Fixed Earnings</span>
                  <span className="text-primary">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
              </div>

              {/* C. Employee Deductions (on Fixed Earnings) */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>C. Employee Deductions (on Fixed Earnings)</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>EPF Employee</span>
                  <span className="font-medium">₹{salary.epf_employee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>ESIC Employee</span>
                  <span className="font-medium">₹{salary.esic_employee.toLocaleString()}</span>
                </div>
                
                {/* Custom Manual Deductions */}
                {salary.manual_deductions_details && Object.entries(salary.manual_deductions_details).map(([name, amount]: any) => (
                  <div key={name} className="flex justify-between text-sm pl-4">
                    <span>{name}</span>
                    <span className="font-medium">₹{(parseFloat(amount) || 0).toLocaleString()}</span>
                  </div>
                ))}
                
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Deductions</span>
                  <span className="text-destructive">₹{salary.total_deductions.toLocaleString()}</span>
                </div>
              </div>

              {/* D. Performance Based Earnings */}
              {salary.variable_earnings_total > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between font-semibold text-base border-b pb-2">
                    <span>D. Performance Based Earnings</span>
                  </div>
                  <div className="flex justify-between text-sm pl-4">
                    <span>Performance Based Earnings</span>
                    <span className="font-medium">₹{salary.variable_earnings_total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold pl-4 text-base">
                    <span>Total Performance Earnings</span>
                    <span className="text-blue-600">₹{salary.variable_earnings_total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* E. Total Gross Earnings */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>E. Total Gross Earnings</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>Fixed Earnings - Deductions</span>
                  <span className="font-medium">₹{(salary.gross_salary - salary.total_deductions).toLocaleString()}</span>
                </div>
                {salary.variable_earnings_total > 0 && (
                  <div className="flex justify-between text-sm pl-4">
                    <span>Performance Based Earnings</span>
                    <span className="font-medium">₹{salary.variable_earnings_total.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xl border-b pb-2">
                  <span>Total Gross Earnings</span>
                  <span className="text-primary">₹{(salary.gross_salary - salary.total_deductions + salary.variable_earnings_total).toLocaleString()}</span>
                </div>
              </div>

              {/* F. Net Payable */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-bold text-xl border-t-2 pt-3 text-green-600">
                  <span>F. Net Payable to Employee</span>
                  <span>₹{salary.final_salary.toLocaleString()}</span>
                </div>
              </div>

              {/* G. Employer Contributions */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-semibold text-base border-b pb-2">
                  <span>G. Employer Contributions</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>EPF Employer</span>
                  <span className="font-medium">₹{salary.epf_employer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pl-4">
                  <span>ESIC Employer</span>
                  <span className="font-medium">₹{salary.esic_employer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold pl-4 text-base">
                  <span>Total Employer Benefit</span>
                  <span>₹{salary.total_employer_contribution.toLocaleString()}</span>
                </div>
              </div>

              {/* H. Total CTC */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-bold text-2xl border-t-2 pt-3 text-primary">
                  <span>H. Total Cost to Company</span>
                  <span>₹{calculatedCTC.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Net Payable + Employer Contributions
                </p>
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

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-8 mt-8">
              <div className="text-center">
                <div className="border-t-2 border-gray-800 pt-4 mt-16">
                  <p className="text-sm font-semibold text-gray-800">Prepared By</p>
                  <p className="text-xs text-gray-600 mt-1">Name & Signature</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-gray-800 pt-4 mt-16">
                  <p className="text-sm font-semibold text-gray-800">Checked By</p>
                  <p className="text-xs text-gray-600 mt-1">Name & Signature</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-gray-800 pt-4 mt-16">
                  <p className="text-sm font-semibold text-gray-800">Approved By</p>
                  <p className="text-xs text-gray-600 mt-1">Name & Signature</p>
                </div>
              </div>
            </div>

            {/* Generated Footer */}
            <div className="text-center text-xs text-gray-500 pt-8 border-t border-gray-300">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p className="mt-1">For any queries regarding your salary, please contact the HR department.</p>
              <p className="mt-3 text-gray-400">Generated on {format(new Date(), "dd MMM yyyy")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
