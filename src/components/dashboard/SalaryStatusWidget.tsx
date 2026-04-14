import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Clock, CheckCircle, Lock, ArrowRight, AlertCircle, Plus, RefreshCw } from "lucide-react";

interface SalaryStats {
  total: number;
  draft: number;
  pendingApproval: number;
  approved: number;
  locked: number;
  totalAmount: number;
}

interface PendingSalary {
  id: string;
  user_id: string;
  employee_name: string;
  base_salary: number;
  net_salary_calculated: number | null;
  net_salary_manual: number | null;
  manager_proposed_salary: number | null;
  manager_justification: string | null;
}

interface SalaryStatusWidgetProps {
  userId: string;
  isAdmin: boolean;
}

export function SalaryStatusWidget({ userId, isAdmin }: SalaryStatusWidgetProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SalaryStats>({
    total: 0,
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    locked: 0,
    totalAmount: 0,
  });
  const [pendingSalaries, setPendingSalaries] = useState<PendingSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<PendingSalary | null>(null);
  const [netSalaryInput, setNetSalaryInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchSalaryStats();
  }, []);

  const fetchSalaryStats = async () => {
    try {
      // Fetch all salary records for current month
      const { data: salaries, error } = await supabase
        .from("salaries")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (error) throw error;

      // Fetch employee names for pending approvals
      const { data: employees } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .eq("is_active", true);

      const employeeMap = new Map(
        employees?.map(e => [e.user_id, `${e.first_name} ${e.last_name}`]) || []
      );

      const records = salaries || [];
      
      const draft = records.filter(s => !s.is_locked && s.approval_status === "draft");
      const pending = records.filter(s => !s.is_locked && s.approval_status === "pending_approval");
      const approved = records.filter(s => !s.is_locked && s.approval_status === "approved");
      const locked = records.filter(s => s.is_locked);
      const totalAmount = records.reduce((sum, s) => sum + (s.final_salary || s.net_salary_calculated || 0), 0);

      setStats({
        total: records.length,
        draft: draft.length,
        pendingApproval: pending.length,
        approved: approved.length,
        locked: locked.length,
        totalAmount,
      });

      // Set pending salaries for quick actions
      setPendingSalaries(
        pending.map(s => ({
          id: s.id,
          user_id: s.user_id,
          employee_name: employeeMap.get(s.user_id) || "Unknown",
          base_salary: s.base_salary,
          net_salary_calculated: s.net_salary_calculated,
          net_salary_manual: s.net_salary_manual,
          manager_proposed_salary: s.manager_proposed_salary,
          manager_justification: s.manager_justification,
        }))
      );
    } catch (error) {
      console.error("Error fetching salary stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlySalaries = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_monthly_salaries", {
        p_year: currentYear,
        p_month: currentMonth,
      });

      if (error) throw error;

      const result = data as { created: number; skipped: number; working_days: number };
      
      toast({
        title: "Salaries Generated",
        description: `Created ${result.created} new records, ${result.skipped} already existed.`,
      });
      
      fetchSalaryStats();
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

  const openNetSalaryDialog = (salary: PendingSalary) => {
    setSelectedSalary(salary);
    setNetSalaryInput(String(salary.manager_proposed_salary || salary.net_salary_calculated || ""));
    setEditDialogOpen(true);
  };

  const handleSetNetSalary = async () => {
    if (!selectedSalary) return;
    
    const netValue = parseFloat(netSalaryInput);
    if (isNaN(netValue) || netValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid salary amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("salaries")
        .update({
          net_salary_manual: netValue,
          final_salary: netValue,
          approval_status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSalary.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Net salary set to ₹${netValue.toLocaleString()} and approved`,
      });
      setEditDialogOpen(false);
      fetchSalaryStats();
    } catch (error) {
      console.error("Error setting net salary:", error);
      toast({
        title: "Error",
        description: "Failed to update salary",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickApprove = async (salaryId: string) => {
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
        description: "Salary approved",
      });
      fetchSalaryStats();
    } catch (error) {
      console.error("Error approving salary:", error);
      toast({
        title: "Error",
        description: "Failed to approve salary",
        variant: "destructive",
      });
    }
  };

  const progressValue = stats.total > 0 ? ((stats.approved + stats.locked) / stats.total) * 100 : 0;

  const getMonthName = (month: number) => {
    return new Date(2024, month - 1).toLocaleString("default", { month: "long" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Salary Processing</CardTitle>
            </div>
            <Badge variant="outline">{getMonthName(currentMonth)} {currentYear}</Badge>
          </div>
          <CardDescription>Current month salary status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing Progress</span>
              <span className="font-medium">{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertCircle className="h-3 w-3" />
                Draft
              </div>
              <div className="text-xl font-bold">{stats.draft}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="h-3 w-3" />
                Pending
              </div>
              <div className="text-xl font-bold text-yellow-600">{stats.pendingApproval}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CheckCircle className="h-3 w-3" />
                Approved
              </div>
              <div className="text-xl font-bold text-blue-600">{stats.approved}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Lock className="h-3 w-3" />
                Locked
              </div>
              <div className="text-xl font-bold text-green-600">{stats.locked}</div>
            </div>
          </div>

          {/* Total amount */}
          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Payroll</span>
              <span className="text-lg font-bold">₹{stats.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Generate Salaries Button - show if no records exist */}
          {isAdmin && stats.total === 0 && (
            <Button 
              className="w-full" 
              onClick={generateMonthlySalaries} 
              disabled={generating}
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate This Month's Salaries
            </Button>
          )}

          {/* Pending approvals for admin */}
          {isAdmin && pendingSalaries.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-medium">Pending Approvals</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingSalaries.slice(0, 3).map((salary) => (
                  <div key={salary.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
                    <div className="text-sm">
                      <div className="font-medium">{salary.employee_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Proposed: ₹{(salary.manager_proposed_salary || salary.net_salary_calculated || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openNetSalaryDialog(salary)}>
                        Set Net
                      </Button>
                      <Button size="sm" onClick={() => handleQuickApprove(salary.id)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {pendingSalaries.length > 3 && (
                <Button variant="link" size="sm" className="w-full" onClick={() => navigate("/salaries")}>
                  View all {pendingSalaries.length} pending
                </Button>
              )}
            </div>
          )}

          {/* Action button */}
          <Button variant="outline" className="w-full" onClick={() => navigate("/salaries")}>
            Manage Salaries
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Admin Net Salary Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Net Salary</DialogTitle>
            <DialogDescription>
              Enter the final net salary for this employee
            </DialogDescription>
          </DialogHeader>
          {selectedSalary && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Employee</Label>
                <div className="font-medium">{selectedSalary.employee_name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Calculated Net</Label>
                  <div className="font-medium">₹{(selectedSalary.net_salary_calculated || 0).toLocaleString()}</div>
                </div>
                {selectedSalary.manager_proposed_salary && (
                  <div>
                    <Label className="text-muted-foreground">Manager Proposed</Label>
                    <div className="font-medium text-blue-600">
                      ₹{selectedSalary.manager_proposed_salary.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {selectedSalary.manager_justification && (
                <div>
                  <Label className="text-muted-foreground">Manager's Justification</Label>
                  <div className="text-sm bg-muted/50 p-2 rounded">{selectedSalary.manager_justification}</div>
                </div>
              )}

              <div>
                <Label htmlFor="netSalary">Final Net Salary (Admin Override)</Label>
                <div className="flex gap-2 mt-1">
                  <span className="flex items-center text-muted-foreground">₹</span>
                  <Input
                    id="netSalary"
                    type="number"
                    value={netSalaryInput}
                    onChange={(e) => setNetSalaryInput(e.target.value)}
                    placeholder="Enter final net salary"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This will override the calculated amount and approve the salary
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetNetSalary} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Set & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
