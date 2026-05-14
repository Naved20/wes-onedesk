import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { SalaryManagement } from "@/components/salary/SalaryManagement";
import { EmployeeSalaryView } from "@/components/salary/EmployeeSalaryView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Plus, Edit, Users, Calculator, TrendingUp, TrendingDown } from "lucide-react";

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  employee_id: string | null;
  institution_assignment: string | null;
  has_salary_structure?: boolean;
}

interface SalaryStructure {
  id: string;
  user_id: string;
  fixed_gross_salary: number;
  basic_percentage: number;
  hra_percentage: number;
  basic_salary: number;
  hra_amount: number;
  other_allowance: number;
  epf_applicable: boolean;
  esic_applicable: boolean;
  bank_account_number: string | null;
  pf_uan_number: string | null;
  esic_ip_number: string | null;
  effective_from: string;
  is_active: boolean;
}

interface EarningType {
  earning_code: string;
  earning_name: string;
  description: string;
  display_order: number;
}

export default function Salaries() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = !isAdmin && !isManager;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [salaryStructure, setSalaryStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [earningTypes, setEarningTypes] = useState<EarningType[]>([]);
  
  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"employee_id" | "name" | "institution" | "designation" | "status">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterInstitution, setFilterInstitution] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    fixed_gross_salary: "",
    basic_percentage: "50",
    hra_percentage: "40",
    other_allowance_percentage: "30",
    // Manual override for components
    basic_salary_manual: "",
    hra_amount_manual: "",
    other_allowance_manual: "",
    // Variable Earnings - Dynamic from earning_types
    variable_earnings: {} as Record<string, string>,
    // Deductions
    pf_deduction_percentage: "12",
    esic_employee_rate: "0.75",
    esic_employer_rate: "3.25",
    manual_deduction: "",
    manual_deduction_remark: "",
    tds_deduction: "",
    professional_tax: "",
    other_deductions: "",
    // Toggles
    epf_applicable: true,
    esic_applicable: true,
    // Bank & Statutory
    bank_account_number: "",
    pf_uan_number: "",
    esic_ip_number: "",
    effective_from: new Date().toISOString().split('T')[0],
    remarks: "",
  });

  // Live Calculations
  const fixedGross = parseFloat(formData.fixed_gross_salary) || 0;
  
  // A. Fixed Salary Breakdown (with manual override support)
  const basicSalary = formData.basic_salary_manual 
    ? parseFloat(formData.basic_salary_manual) 
    : fixedGross * (parseFloat(formData.basic_percentage) || 50) / 100;
  
  const hraAmount = formData.hra_amount_manual
    ? parseFloat(formData.hra_amount_manual)
    : basicSalary * (parseFloat(formData.hra_percentage) || 40) / 100;
  
  const otherAllowance = formData.other_allowance_manual
    ? parseFloat(formData.other_allowance_manual)
    : fixedGross * (parseFloat(formData.other_allowance_percentage) || 30) / 100;
  
  // B. Variable Earnings - Calculate from dynamic earnings
  const totalVariableEarnings = Object.values(formData.variable_earnings).reduce(
    (sum, value) => sum + (parseFloat(value) || 0),
    0
  );
  const totalGrossEarnings = fixedGross + totalVariableEarnings;
  
  // C. Employee Deductions
  const epfWageBase = basicSalary;
  const epfEmployee = formData.epf_applicable ? (epfWageBase * (parseFloat(formData.pf_deduction_percentage) || 12) / 100) : 0;
  const esicEmployee = formData.esic_applicable ? (totalGrossEarnings * (parseFloat(formData.esic_employee_rate) || 0.75) / 100) : 0;
  const manualDeduction = parseFloat(formData.manual_deduction) || 0;
  const tdsDeduction = parseFloat(formData.tds_deduction) || 0;
  const professionalTax = parseFloat(formData.professional_tax) || 0;
  const otherDeductions = parseFloat(formData.other_deductions) || 0;
  
  const totalEmployeeDeductions = epfEmployee + esicEmployee + manualDeduction + tdsDeduction + professionalTax + otherDeductions;
  
  // D. Net Payable
  const netPayable = totalGrossEarnings - totalEmployeeDeductions;
  
  // E. Employer Contributions
  const epfEmployer = formData.epf_applicable ? (epfWageBase * (parseFloat(formData.pf_deduction_percentage) || 12) / 100) : 0;
  const esicEmployer = formData.esic_applicable ? (totalGrossEarnings * (parseFloat(formData.esic_employer_rate) || 3.25) / 100) : 0;
  const totalEmployerBenefit = epfEmployer + esicEmployer;
  
  // F. Total Cost to Company
  const totalCostToCompany = totalGrossEarnings + totalEmployerBenefit;

  useEffect(() => {
    if (isAdmin || isManager) {
      fetchEmployees();
      fetchEarningTypes();
    }
  }, [isAdmin, isManager]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchSalaryStructure(selectedEmployee);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, department, designation, employee_id, institution_assignment")
        .order("first_name");

      if (error) throw error;
      
      // Check which employees have salary structures
      const employeesWithStatus = await Promise.all(
        (data || []).map(async (emp) => {
          const { data: salaryData } = await supabase
            .from("salary_structures")
            .select("id")
            .eq("user_id", emp.user_id)
            .eq("is_active", true)
            .single();
          
          return {
            ...emp,
            has_salary_structure: !!salaryData
          };
        })
      );
      
      setEmployees(employeesWithStatus);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    }
  };

  const fetchEarningTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("earning_types")
        .select("earning_code, earning_name, description, display_order")
        .order("display_order");

      if (error) throw error;
      
      // Filter out HRA_AMOUNT as it's part of fixed salary structure
      const filteredEarnings = (data || []).filter(
        earning => earning.earning_code !== 'HRA_AMOUNT'
      );
      
      setEarningTypes(filteredEarnings);
    } catch (error) {
      console.error("Error fetching earning types:", error);
      // Don't show error toast, just use default fields
      setEarningTypes([]);
    }
  };

  const fetchSalaryStructure = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSalaryStructure(data);
        setFormData({
          fixed_gross_salary: data.fixed_gross_salary.toString(),
          basic_percentage: data.basic_percentage.toString(),
          hra_percentage: data.hra_percentage.toString(),
          other_allowance_percentage: "30",
          basic_salary_manual: "",
          hra_amount_manual: "",
          other_allowance_manual: "",
          variable_earnings: {},
          pf_deduction_percentage: "12",
          esic_employee_rate: "0.75",
          esic_employer_rate: "3.25",
          manual_deduction: "",
          manual_deduction_remark: "",
          tds_deduction: "",
          professional_tax: "",
          other_deductions: "",
          epf_applicable: data.epf_applicable,
          esic_applicable: data.esic_applicable,
          bank_account_number: data.bank_account_number || "",
          pf_uan_number: data.pf_uan_number || "",
          esic_ip_number: data.esic_ip_number || "",
          effective_from: data.effective_from,
          remarks: "",
        });
      } else {
        setSalaryStructure(null);
        setFormData({
          ...formData,
          fixed_gross_salary: "",
          bank_account_number: "",
          pf_uan_number: "",
          esic_ip_number: "",
          variable_earnings: {},
        });
      }
    } catch (error) {
      console.error("Error fetching salary structure:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      });
      return;
    }

    if (!formData.fixed_gross_salary || parseFloat(formData.fixed_gross_salary) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid fixed gross salary",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const salaryData = {
        user_id: selectedEmployee,
        fixed_gross_salary: parseFloat(formData.fixed_gross_salary),
        basic_percentage: parseFloat(formData.basic_percentage),
        hra_percentage: parseFloat(formData.hra_percentage),
        other_allowance_percentage: parseFloat(formData.other_allowance_percentage),
        epf_applicable: formData.epf_applicable,
        esic_applicable: formData.esic_applicable,
        epf_employee_rate: parseFloat(formData.epf_percentage),
        epf_employer_rate: parseFloat(formData.epf_percentage),
        esic_employee_rate: parseFloat(formData.esic_percentage),
        esic_employer_rate: 3.25, // Fixed employer rate
        bank_account_number: formData.bank_account_number || null,
        pf_uan_number: formData.pf_uan_number || null,
        esic_ip_number: formData.esic_ip_number || null,
        effective_from: formData.effective_from,
        is_active: true,
      };

      if (salaryStructure) {
        // Update existing structure
        const { error } = await supabase
          .from("salary_structures")
          .update(salaryData)
          .eq("id", salaryStructure.id);

        if (error) throw error;
      } else {
        // First, deactivate any existing active structures for this user (cleanup)
        await supabase
          .from("salary_structures")
          .update({ is_active: false })
          .eq("user_id", selectedEmployee)
          .eq("is_active", true);

        // Insert new structure
        const { error } = await supabase
          .from("salary_structures")
          .insert(salaryData);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Salary structure saved successfully",
      });

      setDialogOpen(false);
      await fetchEmployees(); // Refresh employee list to update status
      fetchSalaryStructure(selectedEmployee);
    } catch (error: any) {
      console.error("Error saving salary structure:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save salary structure",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployeeData = employees.find(e => e.user_id === selectedEmployee);

  // Filter and Sort employees
  const filteredAndSortedEmployees = employees
    .filter((emp) => {
      if (!searchQuery && filterInstitution === "all" && filterStatus === "all") return true;
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        emp.employee_id?.toLowerCase().includes(query) ||
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(query) ||
        emp.institution_assignment?.toLowerCase().includes(query) ||
        emp.designation?.toLowerCase().includes(query)
      );
      
      const matchesInstitution = filterInstitution === "all" || emp.institution_assignment === filterInstitution;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "configured" && emp.has_salary_structure) ||
        (filterStatus === "not_configured" && !emp.has_salary_structure);
      
      return matchesSearch && matchesInstitution && matchesStatus;
    })
    .sort((a, b) => {
      let aValue: string | boolean = "";
      let bValue: string | boolean = "";

      switch (sortField) {
        case "employee_id":
          aValue = a.employee_id || "";
          bValue = b.employee_id || "";
          break;
        case "name":
          aValue = `${a.first_name} ${a.last_name}`;
          bValue = `${b.first_name} ${b.last_name}`;
          break;
        case "institution":
          aValue = a.institution_assignment || "";
          bValue = b.institution_assignment || "";
          break;
        case "designation":
          aValue = a.designation || "";
          bValue = b.designation || "";
          break;
        case "status":
          aValue = a.has_salary_structure || false;
          bValue = b.has_salary_structure || false;
          break;
      }

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return sortDirection === "asc" 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1);
      }

      const comparison = aValue.toString().localeCompare(bValue.toString());
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

  const handleSetupClick = async (empUserId: string) => {
    setSelectedEmployee(empUserId);
    await fetchSalaryStructure(empUserId);
    setDialogOpen(true);
  };

  // Employee View
  if (user && isEmployee) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salaries</h1>
            <p className="text-muted-foreground">View your salary details and breakdown</p>
          </div>
          <EmployeeSalaryView userId={user.id} isAdmin={false} />
        </div>
      </DashboardLayout>
    );
  }

  // Admin/Manager View
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salaries & Earnings</h1>
            <p className="text-muted-foreground">Manage employee salary structures and calculations</p>
          </div>
        </div>

        <Tabs defaultValue="management" className="space-y-6">
          <TabsList>
            <TabsTrigger value="management">Salary Management</TabsTrigger>
            <TabsTrigger value="structure">Salary Structure Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="space-y-6">
            {user && (isAdmin || isManager) ? (
              <SalaryManagement 
                userId={user.id} 
                isAdmin={isAdmin} 
                isManager={isManager} 
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Please log in to view salary information.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="structure" className="space-y-6">
            {/* Employee List */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Employee Salary Structures
                      </CardTitle>
                      <CardDescription>Click on Setup to configure employee salary structure</CardDescription>
                    </div>
                    <div className="w-72">
                      <Input
                        placeholder="Search by name, ID, institution..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex gap-3">
                    <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Institutions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Institutions</SelectItem>
                        <SelectItem value="WES">WES</SelectItem>
                        <SelectItem value="DPS">DPS</SelectItem>
                        <SelectItem value="CLAS">CLAS</SelectItem>
                        <SelectItem value="WESA">WESA</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="configured">Configured</SelectItem>
                        <SelectItem value="not_configured">Not Configured</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("employee_id")}
                        >
                          <div className="flex items-center gap-2">
                            Employee ID
                            {sortField === "employee_id" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-2">
                            Name
                            {sortField === "name" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("institution")}
                        >
                          <div className="flex items-center gap-2">
                            Institution
                            {sortField === "institution" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("designation")}
                        >
                          <div className="flex items-center gap-2">
                            Designation
                            {sortField === "designation" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-left font-medium cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {sortField === "status" && (
                              <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            {searchQuery || filterInstitution !== "all" || filterStatus !== "all" 
                              ? "No employees found matching your filters" 
                              : "No employees found"}
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedEmployees.map((emp) => (
                          <tr 
                            key={emp.user_id} 
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-3">
                              <span className="font-mono text-sm">{emp.employee_id || '-'}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm text-muted-foreground">{emp.institution_assignment || '-'}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-sm text-muted-foreground">{emp.designation || '-'}</span>
                            </td>
                            <td className="p-3">
                              {emp.has_salary_structure ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Configured
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                  Not Configured
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleSetupClick(emp.user_id)}
                              >
                                Setup
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Results count */}
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing {filteredAndSortedEmployees.length} of {employees.length} employees
                </div>
              </CardContent>
            </Card>

            {/* Salary Structure Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {salaryStructure ? "Edit" : "Create"} Salary Structure - {selectedEmployeeData?.first_name} {selectedEmployeeData?.last_name}
                  </DialogTitle>
                </DialogHeader>
                <SalaryEditForm 
                  formData={formData}
                  setFormData={setFormData}
                  handleSubmit={handleSubmit}
                  loading={loading}
                  setDialogOpen={setDialogOpen}
                  earningTypes={earningTypes}
                  // Fixed Salary Breakdown
                  fixedGross={fixedGross}
                  basicSalary={basicSalary}
                  hraAmount={hraAmount}
                  otherAllowance={otherAllowance}
                  // Variable Earnings
                  totalVariableEarnings={totalVariableEarnings}
                  totalGrossEarnings={totalGrossEarnings}
                  // Deductions
                  epfWageBase={epfWageBase}
                  epfEmployee={epfEmployee}
                  esicEmployee={esicEmployee}
                  totalEmployeeDeductions={totalEmployeeDeductions}
                  // Net & Employer
                  netPayable={netPayable}
                  epfEmployer={epfEmployer}
                  esicEmployer={esicEmployer}
                  totalEmployerBenefit={totalEmployerBenefit}
                  totalCostToCompany={totalCostToCompany}
                />
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}


// Salary Edit Form Component with Complete Payslip Structure
interface SalaryEditFormProps {
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  setDialogOpen: (open: boolean) => void;
  earningTypes: EarningType[];
  // Fixed Salary Breakdown
  fixedGross: number;
  basicSalary: number;
  hraAmount: number;
  otherAllowance: number;
  // Variable Earnings
  totalVariableEarnings: number;
  totalGrossEarnings: number;
  // Deductions
  epfWageBase: number;
  epfEmployee: number;
  esicEmployee: number;
  totalEmployeeDeductions: number;
  // Net & Employer
  netPayable: number;
  epfEmployer: number;
  esicEmployer: number;
  totalEmployerBenefit: number;
  totalCostToCompany: number;
}

function SalaryEditForm({
  formData,
  setFormData,
  handleSubmit,
  loading,
  setDialogOpen,
  earningTypes,
  fixedGross,
  basicSalary,
  hraAmount,
  otherAllowance,
  totalVariableEarnings,
  totalGrossEarnings,
  epfWageBase,
  epfEmployee,
  esicEmployee,
  totalEmployeeDeductions,
  netPayable,
  epfEmployer,
  esicEmployer,
  totalEmployerBenefit,
  totalCostToCompany,
}: SalaryEditFormProps) {
  
  const handleVariableEarningChange = (earningCode: string, value: string) => {
    setFormData({
      ...formData,
      variable_earnings: {
        ...formData.variable_earnings,
        [earningCode]: value
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDE - EARNINGS */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-lg">Earnings</h3>
          </div>

          <div className="space-y-4">
            {/* Fixed Gross Salary */}
            <div className="space-y-2">
              <Label htmlFor="fixed_gross_salary">Fixed Gross Salary (Monthly) *</Label>
              <Input
                id="fixed_gross_salary"
                type="number"
                step="0.01"
                placeholder="10000"
                value={formData.fixed_gross_salary}
                onChange={(e) => setFormData({ ...formData, fixed_gross_salary: e.target.value })}
                required
              />
            </div>

            {/* Basic Salary - Editable with % */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="basic_percentage">Basic %</Label>
                <Input
                  id="basic_percentage"
                  type="number"
                  step="0.01"
                  placeholder="50"
                  value={formData.basic_percentage}
                  onChange={(e) => setFormData({ ...formData, basic_percentage: e.target.value, basic_salary_manual: "" })}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <Input
                id="basic_salary_manual"
                type="number"
                step="0.01"
                placeholder={`Auto: ₹${basicSalary.toFixed(2)}`}
                value={formData.basic_salary_manual}
                onChange={(e) => setFormData({ ...formData, basic_salary_manual: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {formData.basic_salary_manual ? "Manual override" : `Auto: ${formData.basic_percentage}% of Gross = ₹${basicSalary.toFixed(2)}`}
              </p>
            </div>

            {/* HRA - Editable with % */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="hra_percentage">HRA % (of Basic)</Label>
                <Input
                  id="hra_percentage"
                  type="number"
                  step="0.01"
                  placeholder="40"
                  value={formData.hra_percentage}
                  onChange={(e) => setFormData({ ...formData, hra_percentage: e.target.value, hra_amount_manual: "" })}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <Input
                id="hra_amount_manual"
                type="number"
                step="0.01"
                placeholder={`Auto: ₹${hraAmount.toFixed(2)}`}
                value={formData.hra_amount_manual}
                onChange={(e) => setFormData({ ...formData, hra_amount_manual: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {formData.hra_amount_manual ? "Manual override" : `Auto: ${formData.hra_percentage}% of Basic = ₹${hraAmount.toFixed(2)}`}
              </p>
            </div>

            {/* Other Allowance - Editable with % */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="other_allowance_percentage">Other Allowance %</Label>
                <Input
                  id="other_allowance_percentage"
                  type="number"
                  step="0.01"
                  placeholder="30"
                  value={formData.other_allowance_percentage}
                  onChange={(e) => setFormData({ ...formData, other_allowance_percentage: e.target.value, other_allowance_manual: "" })}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <Input
                id="other_allowance_manual"
                type="number"
                step="0.01"
                placeholder={`Auto: ₹${otherAllowance.toFixed(2)}`}
                value={formData.other_allowance_manual}
                onChange={(e) => setFormData({ ...formData, other_allowance_manual: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {formData.other_allowance_manual ? "Manual override" : `Auto: ${formData.other_allowance_percentage}% of Gross = ₹${otherAllowance.toFixed(2)}`}
              </p>
            </div>

            {/* Variable Earnings */}
            <div className="pt-3 border-t">
              <h4 className="text-sm font-medium mb-3">Variable Earnings</h4>
              
              <div className="space-y-3">
                {earningTypes.length > 0 ? (
                  earningTypes.map((earning) => (
                    <div key={earning.earning_code} className="space-y-2">
                      <Label htmlFor={earning.earning_code} title={earning.description}>
                        {earning.earning_name}
                      </Label>
                      <Input
                        id={earning.earning_code}
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings[earning.earning_code] || ""}
                        onChange={(e) => handleVariableEarningChange(earning.earning_code, e.target.value)}
                      />
                    </div>
                  ))
                ) : (
                  // Fallback to hardcoded fields if earning_types not available
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="lesson_plan_incentive">Lesson Plan Incentive</Label>
                      <Input
                        id="lesson_plan_incentive"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['LESSON_PLAN'] || ""}
                        onChange={(e) => handleVariableEarningChange('LESSON_PLAN', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="english_training_incentive">English Training Incentive</Label>
                      <Input
                        id="english_training_incentive"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['ENG_TRAINING'] || ""}
                        onChange={(e) => handleVariableEarningChange('ENG_TRAINING', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="digital_training_incentive">Digital Training Incentive</Label>
                      <Input
                        id="digital_training_incentive"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['DIGITAL_TRAINING'] || ""}
                        onChange={(e) => handleVariableEarningChange('DIGITAL_TRAINING', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="travel_allowance">Travel Allowance</Label>
                      <Input
                        id="travel_allowance"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['TRAVEL_ALLOWANCE'] || ""}
                        onChange={(e) => handleVariableEarningChange('TRAVEL_ALLOWANCE', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="special_bonus">Special Bonus</Label>
                      <Input
                        id="special_bonus"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['SPECIAL_BONUS'] || ""}
                        onChange={(e) => handleVariableEarningChange('SPECIAL_BONUS', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="other_incentive">Other Incentive</Label>
                      <Input
                        id="other_incentive"
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.variable_earnings['OTHER_INCENTIVE'] || ""}
                        onChange={(e) => handleVariableEarningChange('OTHER_INCENTIVE', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE - DEDUCTIONS */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-lg">Deductions</h3>
          </div>

          <div className="space-y-4">
            {/* EPF Deduction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="epf_applicable">EPF Deduction</Label>
                <Switch
                  id="epf_applicable"
                  checked={formData.epf_applicable}
                  onCheckedChange={(checked) => setFormData({ ...formData, epf_applicable: checked })}
                />
              </div>
              {formData.epf_applicable && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pf_deduction_percentage" className="text-xs">EPF %</Label>
                    <Input
                      id="pf_deduction_percentage"
                      type="number"
                      step="0.01"
                      placeholder="12"
                      value={formData.pf_deduction_percentage}
                      onChange={(e) => setFormData({ ...formData, pf_deduction_percentage: e.target.value })}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-sm text-muted-foreground">Employee EPF (Auto)</p>
                    <p className="text-lg font-semibold text-red-700 dark:text-red-400">₹{epfEmployee.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.pf_deduction_percentage}% of Basic (₹{basicSalary.toFixed(2)})
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ESIC Deduction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="esic_applicable">ESIC Deduction</Label>
                <Switch
                  id="esic_applicable"
                  checked={formData.esic_applicable}
                  onCheckedChange={(checked) => setFormData({ ...formData, esic_applicable: checked })}
                />
              </div>
              {formData.esic_applicable && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="esic_employee_rate" className="text-xs">ESIC %</Label>
                    <Input
                      id="esic_employee_rate"
                      type="number"
                      step="0.01"
                      placeholder="0.75"
                      value={formData.esic_employee_rate}
                      onChange={(e) => setFormData({ ...formData, esic_employee_rate: e.target.value })}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-sm text-muted-foreground">Employee ESIC (Auto)</p>
                    <p className="text-lg font-semibold text-red-700 dark:text-red-400">₹{esicEmployee.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.esic_employee_rate}% of Total Gross (₹{totalGrossEarnings.toFixed(2)})
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Manual Deduction */}
            <div className="space-y-2">
              <Label htmlFor="manual_deduction">Manual Deduction</Label>
              <Input
                id="manual_deduction"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.manual_deduction}
                onChange={(e) => setFormData({ ...formData, manual_deduction: e.target.value })}
              />
              <Input
                id="manual_deduction_remark"
                type="text"
                placeholder="Remark (optional)"
                value={formData.manual_deduction_remark}
                onChange={(e) => setFormData({ ...formData, manual_deduction_remark: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* TDS Deduction */}
            <div className="space-y-2">
              <Label htmlFor="tds_deduction">TDS Deduction</Label>
              <Input
                id="tds_deduction"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.tds_deduction}
                onChange={(e) => setFormData({ ...formData, tds_deduction: e.target.value })}
              />
            </div>

            {/* Professional Tax */}
            <div className="space-y-2">
              <Label htmlFor="professional_tax">Professional Tax</Label>
              <Input
                id="professional_tax"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.professional_tax}
                onChange={(e) => setFormData({ ...formData, professional_tax: e.target.value })}
              />
            </div>

            {/* Other Deductions */}
            <div className="space-y-2">
              <Label htmlFor="other_deductions">Other Deductions</Label>
              <Input
                id="other_deductions"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.other_deductions}
                onChange={(e) => setFormData({ ...formData, other_deductions: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - LIVE CALCULATION */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Live Calculation</h3>
          </div>

          {/* Fixed Salary Breakdown */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">A. Fixed Salary Structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Fixed Gross Salary</span>
                <span className="font-semibold">₹{fixedGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Basic ({formData.basic_percentage}%)</span>
                <span className="font-semibold">₹{basicSalary.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">HRA ({formData.hra_percentage}% of Basic)</span>
                <span className="font-semibold">₹{hraAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Other Allowance ({formData.other_allowance_percentage}%)</span>
                <span className="font-semibold">₹{otherAllowance.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Earnings */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">B. Total Earnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Fixed Gross</span>
                <span className="font-semibold">₹{fixedGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Variable Earnings</span>
                <span className="font-semibold">₹{totalVariableEarnings.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium">Total Gross Earnings</span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">₹{totalGrossEarnings.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Deductions */}
          <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">C. Employee Deductions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {formData.epf_applicable && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">EPF Employee</span>
                  <span className="font-semibold">₹{epfEmployee.toFixed(2)}</span>
                </div>
              )}
              {formData.esic_applicable && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">ESIC Employee</span>
                  <span className="font-semibold">₹{esicEmployee.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium">Total Deductions</span>
                <span className="text-lg font-bold text-red-700 dark:text-red-400">₹{totalEmployeeDeductions.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Net Payable */}
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">D. Net Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Net Payable to Employee</span>
                <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">₹{netPayable.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Employer Contributions */}
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">E. Employer Contributions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {formData.epf_applicable && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">EPF Employer ({formData.pf_deduction_percentage}%)</span>
                  <span className="font-semibold">₹{epfEmployer.toFixed(2)}</span>
                </div>
              )}
              {formData.esic_applicable && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">ESIC Employer ({formData.esic_employer_rate}%)</span>
                  <span className="font-semibold">₹{esicEmployer.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium">Total Employer Benefit</span>
                <span className="text-lg font-bold text-orange-700 dark:text-orange-400">₹{totalEmployerBenefit.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Total CTC */}
          <Card className="bg-gradient-to-br from-slate-100 to-gray-100 dark:from-slate-900 dark:to-gray-900 border-slate-300 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">F. Total Cost to Company</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total CTC</span>
                <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">₹{totalCostToCompany.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Gross Earnings + Employer Benefits
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bank & Statutory Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank & Statutory Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Bank Account Number</Label>
              <Input
                id="bank_account_number"
                placeholder="111111111122"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pf_uan_number">PF UAN Number</Label>
              <Input
                id="pf_uan_number"
                placeholder="Enter PF UAN"
                value={formData.pf_uan_number}
                onChange={(e) => setFormData({ ...formData, pf_uan_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esic_ip_number">ESIC IP Number</Label>
              <Input
                id="esic_ip_number"
                placeholder="Enter ESIC IP"
                value={formData.esic_ip_number}
                onChange={(e) => setFormData({ ...formData, esic_ip_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_from">Effective From *</Label>
              <Input
                id="effective_from"
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Salary Structure"}
        </Button>
      </div>
    </form>
  );
}
