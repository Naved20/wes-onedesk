import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Eye, Edit2, RotateCcw, Loader2 } from "lucide-react";
import EditBalanceDialog from "./dialogs/EditBalanceDialog";
import ViewBalanceHistoryDialog from "./dialogs/ViewBalanceHistoryDialog";

interface EmployeeBalance {
  user_id: string;
  employee_name: string;
  department?: string;
  casual_balance: number;
  medical_balance: number;
  emergency_balance: number;
  lop_balance: number;
  half_day_balance: number;
  used_total: number;
  remaining_total: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function EmployeeLeaveBalanceManagement() {
  const [employees, setEmployees] = useState<EmployeeBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [resetFrequency, setResetFrequency] = useState<"monthly" | "quarterly" | "half_yearly" | "yearly">("yearly");
  const [editingEmployee, setEditingEmployee] = useState<EmployeeBalance | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<EmployeeBalance | null>(null);

  useEffect(() => {
    loadResetFrequency();
  }, []);

  useEffect(() => {
    fetchEmployeeBalances();
  }, [selectedMonth, selectedYear]);

  const loadResetFrequency = async () => {
    try {
      const { data } = await supabase
        .from("leave_reset_settings")
        .select("reset_frequency")
        .eq("is_active", true)
        .single();

      if (data) {
        setResetFrequency(data.reset_frequency as any);
      }
    } catch (error) {
      console.error("Error loading reset frequency:", error);
    }
  };

  const fetchEmployeeBalances = async () => {
    setLoading(true);
    try {
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      // Get all employee profiles
      const { data: profiles, error: profileError } = await supabase
        .from("employee_profiles")
        .select("id, user_id, first_name, last_name, department")
        .order("first_name");

      if (profileError) throw profileError;

      // Get leave balances for selected month
      const { data: balances, error: balanceError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (balanceError) throw balanceError;

      // Combine data
      const employeeBalances = (profiles || []).map((profile) => {
        const balance = (balances || []).find(
          (b: any) => b.user_id === profile.user_id
        );
        
        // Get usage from database or default to 0
        const casual = Number(balance?.casual_leaves_used) || 0;
        const medical = Number(balance?.medical_leaves_used) || 0;
        const emergency = Number(balance?.emergency_leaves_used) || 0;
        const lop = Number(balance?.lop_leaves_used) || 0;
        const halfDay = Number(balance?.half_day_leaves_used) || 0;

        // Get entitled from database or default to 6
        const casualLimit = Number(balance?.casual_leaves_entitled) || 6;
        const medicalLimit = Number(balance?.medical_leaves_entitled) || 6;
        const emergencyLimit = Number(balance?.emergency_leaves_entitled) || 6;
        const lopLimit = Number(balance?.lop_leaves_entitled) || 6;
        const halfDayLimit = Number(balance?.half_day_leaves_entitled) || 6;

        // Individual available counts (remaining)
        const casualRemaining = Math.max(0, casualLimit - casual);
        const medicalRemaining = Math.max(0, medicalLimit - medical);
        const emergencyRemaining = Math.max(0, emergencyLimit - emergency);
        const lopRemaining = Math.max(0, lopLimit - lop);
        const halfDayRemaining = Math.max(0, halfDayLimit - halfDay);

        const usedTotal = casual + medical + emergency + lop + halfDay;
        const totalAvailable = casualLimit + medicalLimit + emergencyLimit + lopLimit + halfDayLimit;
        const remainingTotal = Math.max(0, totalAvailable - usedTotal);

        return {
          user_id: profile.user_id,
          employee_name: `${profile.first_name} ${profile.last_name}`,
          department: profile.department || "N/A",
          casual_balance: casualRemaining,    // Shows remaining
          medical_balance: medicalRemaining,  // Shows remaining
          emergency_balance: emergencyRemaining, // Shows remaining
          lop_balance: lopRemaining,          // Shows remaining
          half_day_balance: halfDayRemaining, // Shows remaining
          used_total: usedTotal,
          remaining_total: remainingTotal,
        };
      });

      setEmployees(employeeBalances);
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast({
        title: "Error",
        description: "Failed to fetch employee balances",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await fetchEmployeeBalances();
      return;
    }

    setSearching(true);
    try {
      const filtered = employees.filter((emp) =>
        emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setEmployees(filtered);
    } finally {
      setSearching(false);
    }
  };

  const handleEditBalance = (employee: EmployeeBalance) => {
    setEditingEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleViewHistory = (employee: EmployeeBalance) => {
    setHistoryEmployee(employee);
    setHistoryDialogOpen(true);
  };

  const handleResetBalance = async (employee: EmployeeBalance) => {
    try {
      // Reset balance by creating/updating record with 0 values using upsert
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      const { error } = await supabase
        .from("leave_balances")
        .upsert(
          {
            user_id: employee.user_id,
            month,
            year,
            casual_leaves_used: 0,
            medical_leaves_used: 0,
            emergency_leaves_used: 0,
            lop_leaves_used: 0,
            half_day_leaves_used: 0,
          },
          {
            onConflict: "user_id,month,year",
          }
        );

      if (error) throw error;

      toast({
        title: "Success",
        description: `Balance reset for ${employee.employee_name}`,
      });

      await fetchEmployeeBalances();
    } catch (error) {
      console.error("Error resetting balance:", error);
      toast({
        title: "Error",
        description: "Failed to reset balance",
        variant: "destructive",
      });
    }
  };

  const getBalanceColor = (remaining: number) => {
    if (remaining === 0) return "bg-red-50 border-red-200";
    if (remaining <= 2) return "bg-yellow-50 border-yellow-200";
    return "bg-green-50 border-green-200";
  };

  const getBalanceBadge = (remaining: number) => {
    if (remaining === 0)
      return <Badge variant="destructive">Exhausted</Badge>;
    if (remaining <= 2)
      return <Badge variant="secondary">Low</Badge>;
    return <Badge variant="outline">Available</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Leave Balance Management</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            View, edit, and manage employee leave balances
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {resetFrequency !== "yearly" && (
              <div>
                <label className="text-sm font-medium">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className={resetFrequency !== "yearly" ? "" : "md:col-span-2"}>
              <label className="text-sm font-medium">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 3 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className={resetFrequency !== "yearly" ? "md:col-span-2" : "md:col-span-2"}>
              <label className="text-sm font-medium">Search Employee</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSearch}
                  disabled={searching}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employees found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Casual</TableHead>
                    <TableHead className="text-center">Medical</TableHead>
                    <TableHead className="text-center">Emergency</TableHead>
                    <TableHead className="text-center">LOP</TableHead>
                    <TableHead className="text-center">Half Day</TableHead>
                    <TableHead className="text-center">Used/Total</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow
                      key={employee.user_id}
                      className={getBalanceColor(employee.remaining_total)}
                    >
                      <TableCell className="font-medium">
                        {employee.employee_name}
                      </TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell className="text-center">
                        {employee.casual_balance}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.medical_balance}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.emergency_balance}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.lop_balance}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.half_day_balance}
                      </TableCell>
                      <TableCell className="text-center">
                        {employee.used_total}/{30}
                      </TableCell>
                      <TableCell className="text-center">
                        {getBalanceBadge(employee.remaining_total)}{" "}
                        <span className="font-semibold ml-1">
                          {employee.remaining_total}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewHistory(employee)}
                            title="View history"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBalance(employee)}
                            title="Edit balance"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetBalance(employee)}
                            title="Reset balance"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
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

      {/* Dialogs */}
      <EditBalanceDialog
        employee={editingEmployee}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={fetchEmployeeBalances}
      />

      <ViewBalanceHistoryDialog
        employee={historyEmployee}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />
    </div>
  );
}
