import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, TrendingDown, Briefcase, Calendar, AlertCircle, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface EmployeeSalaryDetailsProps {
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

export function EmployeeSalaryDetails({ userId, month: initialMonth, year: initialYear }: EmployeeSalaryDetailsProps) {
  const [salary, setSalary] = useState<SalaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear());

  useEffect(() => {
    fetchSalaryDetails();
  }, [selectedMonth, selectedYear, userId]);

  const fetchSalaryDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("salaries" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSalary(data as SalaryDetail);
      } else {
        setSalary(null);
        toast({
          title: "No Data",
          description: `No salary record found for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching salary details:", error);
      toast({
        title: "Error",
        description: "Failed to load salary details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    // TODO: Implement PDF download
    toast({
      title: "Coming Soon",
      description: "PDF download feature will be available soon",
    });
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
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No salary record found for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = months.find(m => m.value === selectedMonth)?.label;

  return (
    <div className="space-y-6">
      {/* Header with Month/Year Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-primary" />
                Salary Details - {monthLabel} {selectedYear}
              </CardTitle>
              <CardDescription>
                Complete breakdown of your salary for this month
              </CardDescription>
            </div>
            <Button onClick={downloadPDF} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download Payslip
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Status Badge */}
      <div className="flex gap-2">
        <Badge variant={salary.is_locked ? "default" : "secondary"}>
          {salary.is_locked ? "🔒 Locked" : "📝 Draft"}
        </Badge>
        <Badge variant={salary.approval_status === "approved" ? "default" : "outline"}>
          {salary.approval_status === "approved" ? "✓ Approved" : "⏳ Pending"}
        </Badge>
      </div>

      {/* Main Salary Breakdown */}
      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-6">
          {/* Attendance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Working Days</p>
                  <p className="text-2xl font-bold text-blue-600">{salary.working_days}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Present Days</p>
                  <p className="text-2xl font-bold text-green-600">{salary.present_days}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Paid Leaves</p>
                  <p className="text-2xl font-bold text-purple-600">{salary.paid_leave_days}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Absent Days</p>
                  <p className="text-2xl font-bold text-red-600">{salary.absent_days}</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Paid Days:</span>
                  <span className="text-xl font-bold text-primary">
                    {salary.present_days + salary.paid_leave_days} days
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fixed Salary Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                Fixed Salary Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">Fixed Gross Salary (Monthly)</span>
                  <span className="text-lg font-bold text-primary">₹{salary.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>Basic Salary (Earned)</span>
                  <span className="font-semibold">₹{salary.basic_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>HRA (Earned)</span>
                  <span className="font-semibold">₹{salary.hra_earned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>Other Allowance (Earned)</span>
                  <span className="font-semibold">₹{salary.other_allowance_earned.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variable Earnings */}
          {salary.variable_earnings_total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Variable Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(salary.variable_earnings_details || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-green-600">₹{Number(value).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950 rounded-lg font-semibold">
                    <span>Total Variable Earnings</span>
                    <span className="text-lg text-green-600">₹{salary.variable_earnings_total.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Total Gross Earnings */}
          <Card className="border-2 border-primary">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">Total Gross Earnings</span>
                <span className="text-3xl font-bold text-primary">₹{salary.gross_salary.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Fixed ({salary.basic_earned + salary.hra_earned + salary.other_allowance_earned}) + Variable ({salary.variable_earnings_total})
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Working Days in Month</p>
                    <p className="text-3xl font-bold">{salary.working_days}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Days Worked</p>
                    <p className="text-3xl font-bold text-green-600">{salary.present_days}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Paid Leaves Taken</p>
                    <p className="text-3xl font-bold text-purple-600">{salary.paid_leave_days}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Absent Days</p>
                    <p className="text-3xl font-bold text-red-600">{salary.absent_days}</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Total Paid Days</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {salary.present_days + salary.paid_leave_days} days
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {salary.present_days} present + {salary.paid_leave_days} paid leaves
                  </p>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Attendance Percentage</span>
                    <span className="text-2xl font-bold text-amber-600">
                      {((salary.present_days / salary.working_days) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on {salary.present_days} days present out of {salary.working_days} working days
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions" className="space-y-6">
          {/* Employee Deductions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Employee Deductions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>EPF (Employee Provident Fund)</span>
                  <span className="font-semibold text-red-600">-₹{salary.epf_employee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>ESIC (Employee State Insurance)</span>
                  <span className="font-semibold text-red-600">-₹{salary.esic_employee.toLocaleString()}</span>
                </div>
                {salary.manual_deduction > 0 && (
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Manual Deduction</span>
                    <span className="font-semibold text-red-600">-₹{salary.manual_deduction.toLocaleString()}</span>
                  </div>
                )}
                {salary.tds_deduction > 0 && (
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>TDS (Tax Deducted at Source)</span>
                    <span className="font-semibold text-red-600">-₹{salary.tds_deduction.toLocaleString()}</span>
                  </div>
                )}
                {salary.professional_tax > 0 && (
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Professional Tax</span>
                    <span className="font-semibold text-red-600">-₹{salary.professional_tax.toLocaleString()}</span>
                  </div>
                )}
                {salary.other_deductions > 0 && (
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Other Deductions</span>
                    <span className="font-semibold text-red-600">-₹{salary.other_deductions.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950 rounded-lg font-semibold">
                  <span>Total Deductions</span>
                  <span className="text-lg text-red-600">-₹{salary.total_deductions.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employer Contributions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Employer Contributions (Not Deducted from Your Salary)
              </CardTitle>
              <CardDescription>
                These are benefits provided by the company on your behalf
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>EPF Employer Contribution</span>
                  <span className="font-semibold text-green-600">+₹{salary.epf_employer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span>ESIC Employer Contribution</span>
                  <span className="font-semibold text-green-600">+₹{salary.esic_employer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950 rounded-lg font-semibold">
                  <span>Total Employer Contribution</span>
                  <span className="text-lg text-green-600">+₹{salary.total_employer_contribution.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {/* Net Salary Summary */}
          <Card className="border-2 border-green-600">
            <CardHeader>
              <CardTitle className="text-2xl">Your Net Salary</CardTitle>
              <CardDescription>Amount you will receive in your bank account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <span className="text-lg font-semibold">Gross Earnings</span>
                  <span className="text-2xl font-bold text-green-600">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <span className="text-lg font-semibold">Total Deductions</span>
                  <span className="text-2xl font-bold text-red-600">-₹{salary.total_deductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                  <span className="text-xl font-bold">Net Salary (Take Home)</span>
                  <span className="text-3xl font-bold text-primary">₹{salary.final_salary.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total CTC */}
          <Card className="border-2 border-blue-600">
            <CardHeader>
              <CardTitle className="text-2xl">Total Cost to Company (CTC)</CardTitle>
              <CardDescription>Total value of your compensation package</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <span className="text-lg font-semibold">Gross Earnings</span>
                  <span className="text-2xl font-bold text-blue-600">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <span className="text-lg font-semibold">Employer Contributions</span>
                  <span className="text-2xl font-bold text-purple-600">+₹{salary.total_employer_contribution.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-600 text-white rounded-lg border-2 border-blue-600">
                  <span className="text-xl font-bold">Total CTC</span>
                  <span className="text-3xl font-bold">₹{salary.total_ctc.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Your CTC includes your net salary plus employer contributions for EPF and ESIC. This represents the total value of your compensation package.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Salary Breakdown Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-2 border-b">
                  <span>Fixed Gross Salary</span>
                  <span className="font-semibold">₹{salary.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 border-b">
                  <span>Working Days</span>
                  <span className="font-semibold">{salary.working_days} days</span>
                </div>
                <div className="flex justify-between p-2 border-b">
                  <span>Paid Days (Present + Leaves)</span>
                  <span className="font-semibold">{salary.present_days + salary.paid_leave_days} days</span>
                </div>
                <div className="flex justify-between p-2 border-b">
                  <span>Gross Earned</span>
                  <span className="font-semibold">₹{salary.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 border-b">
                  <span>Total Deductions</span>
                  <span className="font-semibold text-red-600">-₹{salary.total_deductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-primary/5 rounded font-bold">
                  <span>Net Salary</span>
                  <span className="text-primary">₹{salary.final_salary.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
