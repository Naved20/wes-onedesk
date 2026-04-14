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
  casual_leaves_entitled: number;
  casual_leaves_used: number;
  sick_leaves_used: number;
  unplanned_leaves_used: number;
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
          casual_leaves_entitled: data.casual_leaves_entitled ?? 2,
          casual_leaves_used: Number(data.casual_leaves_used) ?? 0,
          sick_leaves_used: Number(data.sick_leaves_used) ?? 0,
          unplanned_leaves_used: Number(data.unplanned_leaves_used) ?? 0,
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
          // Use defaults
          setLeaveBalance({
            casual_leaves_entitled: 2,
            casual_leaves_used: 0,
            sick_leaves_used: 0,
            unplanned_leaves_used: 0,
          });
        } else if (newBalance) {
          setLeaveBalance({
            casual_leaves_entitled: newBalance.casual_leaves_entitled ?? 2,
            casual_leaves_used: Number(newBalance.casual_leaves_used) ?? 0,
            sick_leaves_used: Number(newBalance.sick_leaves_used) ?? 0,
            unplanned_leaves_used: Number(newBalance.unplanned_leaves_used) ?? 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching leave balance:", error);
      setLeaveBalance({
        casual_leaves_entitled: 2,
        casual_leaves_used: 0,
        sick_leaves_used: 0,
        unplanned_leaves_used: 0,
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

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({ 
          status: "approved", 
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

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
    switch (type) {
      case "casual":
        return <Badge variant="outline">Casual</Badge>;
      case "sick":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">Sick (50%)</Badge>;
      case "unplanned":
        return <Badge variant="destructive">Unplanned (100%)</Badge>;
      case "emergency":
        return <Badge variant="outline" className="border-red-500 text-red-600">Emergency</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const casualRemaining = leaveBalance 
    ? Math.max(0, leaveBalance.casual_leaves_entitled - leaveBalance.casual_leaves_used)
    : 2;

  const openApprovalDialog = (leave: LeaveWithEmployee) => {
    setSelectedLeave(leave);
    setApprovalDialogOpen(true);
  };

  const pendingLeaves = leaves.filter(
    (l) => l.status === "pending" && !l.auto_rejected
  );

  const isManagerOrAdmin = role === "admin" || role === "manager";

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LeaveBalanceCard balance={leaveBalance} loading={balanceLoading} />
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Leave Policy Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p><strong>Casual Leave:</strong> 2 days/month maximum</p>
                    <p className="text-primary font-medium">• 1 day per application only</p>
                    <p>• Requires 3-day advance notice</p>
                    <p>• Maximum 1 leave per week</p>
                    <p>• No salary deduction</p>
                  </div>
                  <div className="space-y-2">
                    <p><strong>Sick Leave:</strong> With medical proof</p>
                    <p>• 50% salary deduction</p>
                    <p><strong>Unplanned Leave:</strong></p>
                    <p>• 100% salary deduction</p>
                  </div>
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
