import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Eye, AlertTriangle, ListChecks } from "lucide-react";
import { LeaveBalanceCard } from "@/components/leaves/LeaveBalanceCard";
import { LeaveApplicationForm } from "@/components/leaves/LeaveApplicationForm";
import { LeaveApprovalDialog } from "@/components/leaves/LeaveApprovalDialog";
import { BulkLeaveApproval } from "@/components/leaves/BulkLeaveApproval";

interface LeaveBalance {
  casual_leaves_used: number;
  medical_leaves_used: number;
  emergency_leaves_used: number;
  lop_leaves_used: number;
  half_day_leaves_used: number;
}

interface LeaveWithEmployee {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string | null;
  is_emergency: boolean | null;
  leave_type: string | null;
  is_half_day: boolean | null;
  half_day_type: string | null;
  working_days_count: number | null;
  salary_deduction_percent: number | null;
  auto_rejected: boolean | null;
  auto_rejection_reason: string | null;
  created_at: string;
  employee_name?: string;
}

// Leave type display config
const LEAVE_TYPE_CONFIG: Record<string, { label: string; code: string; variant: "outline" | "secondary" | "destructive" | "default"; className?: string }> = {
  casual: { label: "Casual Leave", code: "PL", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  medical: { label: "Medical Leave", code: "PL", variant: "secondary", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  emergency: { label: "Emergency", code: "LE", variant: "outline", className: "border-red-500 text-red-600" },
  lop: { label: "LOP", code: "LE", variant: "destructive" },
  half_day: { label: "Half Day", code: "HD", variant: "secondary", className: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
  // Legacy types for backward compatibility
  sick: { label: "Medical", code: "PL", variant: "secondary", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  unplanned: { label: "LOP", code: "LE", variant: "destructive" },
};

export default function Leaves() {
  const { user, role } = useAuth();
  const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveWithEmployee | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  useEffect(() => {
    fetchLeaves();
    if (user && role === "employee") {
      fetchLeaveBalance();
    }
  }, [role, user]);

  const fetchLeaveBalance = async () => {
    if (!user) return;
    setBalanceLoading(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Try to get existing balance
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLeaveBalance({
          casual_leaves_used: Number(data.casual_leaves_used) || 0,
          medical_leaves_used: Number((data as any).medical_leaves_used) || 0,
          emergency_leaves_used: Number((data as any).emergency_leaves_used) || 0,
          lop_leaves_used: Number((data as any).lop_leaves_used) || 0,
          half_day_leaves_used: Number((data as any).half_day_leaves_used) || 0,
        });
      } else {
        // Create new balance record
        const { data: newBalance, error: insertError } = await supabase
          .from("leave_balances")
          .insert({
            user_id: user.id,
            year,
            month,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating balance:", insertError);
          setLeaveBalance({
            casual_leaves_used: 0,
            medical_leaves_used: 0,
            emergency_leaves_used: 0,
            lop_leaves_used: 0,
            half_day_leaves_used: 0,
          });
        } else if (newBalance) {
          setLeaveBalance({
            casual_leaves_used: Number(newBalance.casual_leaves_used) || 0,
            medical_leaves_used: Number((newBalance as any).medical_leaves_used) || 0,
            emergency_leaves_used: Number((newBalance as any).emergency_leaves_used) || 0,
            lop_leaves_used: Number((newBalance as any).lop_leaves_used) || 0,
            half_day_leaves_used: Number((newBalance as any).half_day_leaves_used) || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching leave balance:", error);
      setLeaveBalance({
        casual_leaves_used: 0,
        medical_leaves_used: 0,
        emergency_leaves_used: 0,
        lop_leaves_used: 0,
        half_day_leaves_used: 0,
      });
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchLeaves = async () => {
    try {
      const { data: leavesData, error } = await supabase
        .from("leaves")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For managers and admins, fetch employee names
      if ((role === "admin" || role === "manager") && leavesData && leavesData.length > 0) {
        const userIds = [...new Set(leavesData.map(l => l.user_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds)
          .eq("is_active", true);

        const profileMap = new Map(
          profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
        );

        const leavesWithNames = leavesData.map(leave => ({
          ...leave,
          employee_name: profileMap.get(leave.user_id) || "Unknown",
        }));

        setLeaves(leavesWithNames as LeaveWithEmployee[]);
      } else {
        setLeaves((leavesData || []) as LeaveWithEmployee[]);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
      toast({
        title: "Error",
        description: "Failed to load leave records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to update leave balance based on leave type
  async function updateLeaveBalance(leave: LeaveWithEmployee) {
    if (!leave) return;
    const type = leave.leave_type;
    const userId = leave.user_id;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const columnMap: Record<string, string> = {
      casual: 'casual_leaves_used',
      medical: 'medical_leaves_used',
      // Treat emergency as LOP (Leave Without Pay)
      emergency: 'lop_leaves_used',
      lop: 'lop_leaves_used',
      half_day: 'half_day_leaves_used',
    };
    const column = columnMap[type || ''];
    if (!column) return;
    const increment = type === 'half_day' ? 0.5 : 1;
    try {
      const { data: bal, error: balErr } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      if (balErr) throw balErr;
      if (bal) {
        const current = Number(bal[column as keyof typeof bal]) || 0;
        const { error: updErr } = await supabase
          .from('leave_balances')
          .update({ [column]: current + increment })
          .eq('id', bal.id);
        if (updErr) throw updErr;
      } else {
        const newRow: any = {
          user_id: userId,
          month,
          year,
          [column]: increment,
        };
        const { error: insErr } = await supabase.from('leave_balances').insert(newRow);
        if (insErr) throw insErr;
      }
      // Set salary deduction percent based on leave type
      if (type === 'emergency') {
        const { error: dedErr } = await supabase
          .from('leaves')
          .update({ salary_deduction_percent: 100 })
          .eq('id', leave.id);
        if (dedErr) throw dedErr;
      } else if (type === 'medical') {
        const { error: dedErr } = await supabase
          .from('leaves')
          .update({ salary_deduction_percent: 0 })
          .eq('id', leave.id);
        if (dedErr) throw dedErr;
      }
    } catch (e) {
      console.error('Error updating leave balance:', e);
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const leave = leaves.find((l) => l.id === id);
      if (!leave) throw new Error("Leave not found");

      const { error } = await supabase
        .from("leaves")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Update balance for the approved leave
      await updateLeaveBalance(leave);

      toast({ title: "Approved", description: "Leave request approved successfully." });
      fetchLeaves();
      if (role === "employee") fetchLeaveBalance();
    } catch (error) {
      console.error("Error approving:", error);
      toast({ title: "Error", description: "Failed to approve leave", variant: "destructive" });
    }
  };

  const handleReject = async (id: string, rejectionReason: string) => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Rejected", description: "Leave request rejected." });
      fetchLeaves();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({ title: "Error", description: "Failed to reject leave", variant: "destructive" });
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    const { error } = await supabase
      .from("leaves")
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) throw error;
    fetchLeaves();
    if (role === "employee") fetchLeaveBalance();
  };

  const handleBulkReject = async (ids: string[], reason: string) => {
    const { error } = await supabase
      .from("leaves")
      .update({
        status: "rejected",
        rejection_reason: reason,
      })
      .in("id", ids);

    if (error) throw error;
    fetchLeaves();
  };

  const getStatusBadge = (leave: LeaveWithEmployee) => {
    if (leave.auto_rejected) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Auto-Rejected
        </Badge>
      );
    }
    switch (leave.status) {
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getLeaveTypeBadge = (leave: LeaveWithEmployee) => {
    const type = leave.leave_type || "casual";
    const config = LEAVE_TYPE_CONFIG[type] || LEAVE_TYPE_CONFIG.casual;
    return (
      <div className="flex items-center gap-1">
        <Badge variant={config.variant} className={config.className}>
          {config.label}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {config.code}
        </Badge>
      </div>
    );
  };

  const openApprovalDialog = (leave: LeaveWithEmployee) => {
    setSelectedLeave(leave);
    setApprovalDialogOpen(true);
  };

  const pendingLeaves = leaves.filter(
    (l) => l.status === "pending" && !l.auto_rejected
  );

  const isManagerOrAdmin = role === "admin" || role === "manager";

  // Calculate casual remaining for backward compat prop
  const casualRemaining = leaveBalance ? Math.max(0, 6 - leaveBalance.casual_leaves_used) : 6;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leaves</h1>
            <p className="text-muted-foreground">Manage leave requests and approvals</p>
          </div>
          {role === "employee" && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Apply for Leave
            </Button>
          )}
        </div>

        {/* Leave Balance Card for Employees */}
        {role === "employee" && (
          <div className="grid grid-cols-1 gap-4">
            <LeaveBalanceCard balance={leaveBalance} loading={balanceLoading} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Leave Policy Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Leave Type</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Advance Notice</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Max Days</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Balance</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Salary Impact</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Code</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 px-2 font-medium">Casual / Paid Leave</td>
                        <td className="py-2 px-2">4 Days Before</td>
                        <td className="py-2 px-2">2 Days</td>
                        <td className="py-2 px-2">6</td>
                        <td className="py-2 px-2 text-green-600">Paid Time Off</td>
                        <td className="py-2 px-2"><Badge variant="outline">PL</Badge></td>
                        <td className="py-2 px-2">At Request</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-2 font-medium">Medical Leave</td>
                        <td className="py-2 px-2">Same Day</td>
                        <td className="py-2 px-2">2 Days</td>
                        <td className="py-2 px-2">6</td>
                        <td className="py-2 px-2 text-green-600">Paid Time Off</td>
                        <td className="py-2 px-2"><Badge variant="outline">PL</Badge></td>
                        <td className="py-2 px-2">At Request</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-2 font-medium">Emergency Leave</td>
                        <td className="py-2 px-2">Same Day</td>
                        <td className="py-2 px-2">1 Day</td>
                        <td className="py-2 px-2">6</td>
                        <td className="py-2 px-2 text-amber-600">1 LOP</td>
                        <td className="py-2 px-2"><Badge variant="outline">LE</Badge></td>
                        <td className="py-2 px-2">After 2 Days</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-2 font-medium">Leave Without Pay / LOP</td>
                        <td className="py-2 px-2">Next Day</td>
                        <td className="py-2 px-2">1 Day</td>
                        <td className="py-2 px-2">6</td>
                        <td className="py-2 px-2 text-amber-600">1 LOP</td>
                        <td className="py-2 px-2"><Badge variant="outline">LE</Badge></td>
                        <td className="py-2 px-2">At Request</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-medium">Half-Day Leave</td>
                        <td className="py-2 px-2">1 Day Before</td>
                        <td className="py-2 px-2">1 Day</td>
                        <td className="py-2 px-2">6</td>
                        <td className="py-2 px-2 text-amber-600">0.5 LOP</td>
                        <td className="py-2 px-2"><Badge variant="outline">HD</Badge></td>
                        <td className="py-2 px-2">At Request</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground space-y-1">
                  <p><strong>PL Total Balance:</strong> 12 (Casual 6 + Medical 6) | <strong>LE Total Balance:</strong> 12 (Emergency 6 + LOP 6) | <strong>HD Total Balance:</strong> 6</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Manager/Admin View with Tabs */}
        {isManagerOrAdmin ? (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Pending ({pendingLeaves.length})
              </TabsTrigger>
              <TabsTrigger value="all">All Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Leave Approval</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : pendingLeaves.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending leave requests
                    </div>
                  ) : (
                    <BulkLeaveApproval
                      pendingLeaves={pendingLeaves}
                      selectedIds={selectedBulkIds}
                      onSelectionChange={setSelectedBulkIds}
                      onBulkApprove={handleBulkApprove}
                      onBulkReject={handleBulkReject}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Leave Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : leaves.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave requests found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaves.map((leave) => (
                            <TableRow key={leave.id} className={leave.auto_rejected ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{leave.employee_name || "-"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {format(new Date(leave.start_date), "MMM dd")} - {format(new Date(leave.end_date), "MMM dd, yyyy")}
                                </div>
                                {leave.is_half_day && (
                                  <div className="text-xs text-muted-foreground">
                                    {leave.half_day_type === "first_half" ? "Morning" : "Afternoon"}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {leave.working_days_count || 1}
                                {leave.is_half_day && " (half)"}
                              </TableCell>
                              <TableCell>{getLeaveTypeBadge(leave)}</TableCell>
                              <TableCell className="max-w-[200px]">
                                <div className="truncate" title={leave.reason}>{leave.reason}</div>
                                {leave.auto_rejection_reason && (
                                  <div className="text-xs text-destructive mt-1">{leave.auto_rejection_reason}</div>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(leave)}</TableCell>
                              <TableCell className="text-right">
                                {leave.status === "pending" && !leave.auto_rejected && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApprovalDialog(leave)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Review
                                  </Button>
                                )}
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
          </Tabs>
        ) : (
          /* Employee View */
          <Card>
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dates</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => (
                        <TableRow key={leave.id} className={leave.auto_rejected ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(leave.start_date), "MMM dd")} - {format(new Date(leave.end_date), "MMM dd, yyyy")}
                            </div>
                            {leave.is_half_day && (
                              <div className="text-xs text-muted-foreground">
                                {leave.half_day_type === "first_half" ? "Morning" : "Afternoon"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {leave.working_days_count || 1}
                            {leave.is_half_day && " (half)"}
                          </TableCell>
                          <TableCell>{getLeaveTypeBadge(leave)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate" title={leave.reason}>{leave.reason}</div>
                            {leave.auto_rejection_reason && (
                              <div className="text-xs text-destructive mt-1">{leave.auto_rejection_reason}</div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(leave)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leave Application Form Dialog */}
      {user && (
        <LeaveApplicationForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            fetchLeaves();
            fetchLeaveBalance();
            toast({
              title: "Leave Applied",
              description: "Your leave request has been submitted.",
            });
          }}
          userId={user.id}
          casualLeavesRemaining={casualRemaining}
          leaveBalancesUsed={leaveBalance ? {
            casual: leaveBalance.casual_leaves_used,
            medical: leaveBalance.medical_leaves_used,
            emergency: leaveBalance.emergency_leaves_used,
            lop: leaveBalance.lop_leaves_used,
            half_day: leaveBalance.half_day_leaves_used,
          } : undefined}
        />
      )}

      {/* Leave Approval Dialog */}
      <LeaveApprovalDialog
        leave={selectedLeave}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </DashboardLayout>
  );
}
