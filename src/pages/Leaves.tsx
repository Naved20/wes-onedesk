import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Eye,
  MessageSquare,
  FileText,
  ExternalLink,
  Search,
  Filter,
  RotateCcw,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { LeaveBalanceCard } from "@/components/leaves/LeaveBalanceCard";
import { LeaveApplicationForm } from "@/components/leaves/LeaveApplicationForm";
import { LeaveApprovalDialog } from "@/components/leaves/LeaveApprovalDialog";
import { AdminLeaveBalance } from "@/components/leaves/AdminLeaveBalance";
import { LeaveChatDialog } from "@/components/leaves/LeaveChatDialog";
import { EmployeeLeaveRulesView } from "@/components/leaves/EmployeeLeaveRulesView";

interface LeaveBalance {
  casual_leaves_used: number;
  medical_leaves_used: number;
  emergency_leaves_used: number;
  lop_leaves_used: number;
  half_day_leaves_used: number;
  casual_leaves_entitled?: number;
  medical_leaves_entitled?: number;
  emergency_leaves_entitled?: number;
  lop_leaves_entitled?: number;
  half_day_leaves_entitled?: number;
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
  document_url?: string | null;
  document_name?: string | null;
  created_at: string;
  employee_name?: string;
}

// Leave type display config
const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; code: string; variant: "outline" | "secondary" | "destructive" | "default"; className?: string }
> = {
  casual: { label: "Casual Leave", code: "PL", variant: "default", className: "bg-green-600 hover:bg-green-700 text-white" },
  medical: { label: "Medical Leave", code: "PL", variant: "secondary", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  emergency: { label: "Emergency", code: "LE", variant: "outline", className: "border-red-500 text-red-600" },
  lop: { label: "LOP", code: "LE", variant: "destructive" },
  half_day: { label: "Half Day", code: "HD", variant: "secondary", className: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
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
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [chatLeave, setChatLeave] = useState<LeaveWithEmployee | null>(null);
  const [showRules, setShowRules] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const openChatDialog = (leave: LeaveWithEmployee) => {
    setChatLeave(leave);
    setChatDialogOpen(true);
  };

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
      const year = now.getFullYear();

      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLeaveBalance({
          casual_leaves_used: Number(data.casual_leaves_used) || 0,
          medical_leaves_used: Number((data as any).medical_leaves_used) || 0,
          emergency_leaves_used: Number((data as any).emergency_leaves_used) || 0,
          lop_leaves_used: Number((data as any).lop_leaves_used) || 0,
          half_day_leaves_used: Number((data as any).half_day_leaves_used) || 0,
          casual_leaves_entitled: Number((data as any).casual_leaves_entitled) || 6,
          medical_leaves_entitled: Number((data as any).medical_leaves_entitled) || 6,
          emergency_leaves_entitled: Number((data as any).emergency_leaves_entitled) || 6,
          lop_leaves_entitled: Number((data as any).lop_leaves_entitled) || 6,
          half_day_leaves_entitled: Number((data as any).half_day_leaves_entitled) || 6,
        });
      } else {
        const { data: newBalance, error: insertError } = await supabase
          .from("leave_balances")
          .insert({
            user_id: user.id,
            year,
            month: 1,
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
            casual_leaves_entitled: 6,
            medical_leaves_entitled: 6,
            emergency_leaves_entitled: 6,
            lop_leaves_entitled: 6,
            half_day_leaves_entitled: 6,
          });
        } else if (newBalance) {
          setLeaveBalance({
            casual_leaves_used: Number(newBalance.casual_leaves_used) || 0,
            medical_leaves_used: Number((newBalance as any).medical_leaves_used) || 0,
            emergency_leaves_used: Number((newBalance as any).emergency_leaves_used) || 0,
            lop_leaves_used: Number((newBalance as any).lop_leaves_used) || 0,
            half_day_leaves_used: Number((newBalance as any).half_day_leaves_used) || 0,
            casual_leaves_entitled: Number((newBalance as any).casual_leaves_entitled) || 6,
            medical_leaves_entitled: Number((newBalance as any).medical_leaves_entitled) || 6,
            emergency_leaves_entitled: Number((newBalance as any).emergency_leaves_entitled) || 6,
            lop_leaves_entitled: Number((newBalance as any).lop_leaves_entitled) || 6,
            half_day_leaves_entitled: Number((newBalance as any).half_day_leaves_entitled) || 6,
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

      if ((role === "admin" || role === "manager") && leavesData && leavesData.length > 0) {
        const userIds = [...new Set(leavesData.map((l) => l.user_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds)
          .eq("is_active", true);

        const profileMap = new Map(
          profiles?.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
        );

        const leavesWithNames = leavesData.map((leave) => ({
          ...leave,
          employee_name: profileMap.get(leave.user_id) || "Employee",
        }));

        setLeaves(leavesWithNames);
      } else if (leavesData) {
        if (role === "employee" && user) {
          const myLeaves = leavesData.filter((l) => l.user_id === user.id);
          setLeaves(myLeaves);
        } else {
          setLeaves(leavesData);
        }
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
      toast({
        title: "Error",
        description: "Failed to load leave requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const targetLeave = leaves.find((l) => l.id === id);
      if (!targetLeave) return;

      const { error } = await supabase
        .from("leaves")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request approved",
      });

      fetchLeaves();
    } catch (error) {
      console.error("Error approving leave:", error);
      toast({
        title: "Error",
        description: "Failed to approve leave request",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string, rejectionReason: string) => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "rejected",
          auto_rejection_reason: rejectionReason,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request rejected",
      });

      fetchLeaves();
    } catch (error) {
      console.error("Error rejecting leave:", error);
      toast({
        title: "Error",
        description: "Failed to reject leave request",
        variant: "destructive",
      });
    }
  };

  const handleUndo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "pending",
          auto_rejected: false,
          auto_rejection_reason: null,
          rejection_reason: null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Undo Successful",
        description: "Leave request reset to pending status",
      });

      fetchLeaves();
      if (role === "employee") {
        fetchLeaveBalance();
      }
    } catch (error) {
      console.error("Error undoing leave decision:", error);
      toast({
        title: "Error",
        description: "Failed to undo leave decision",
        variant: "destructive",
      });
    }
  };

  const openApprovalDialog = (leave: LeaveWithEmployee) => {
    setSelectedLeave(leave);
    setApprovalDialogOpen(true);
  };

  const isManagerOrAdmin = role === "admin" || role === "manager";

  const casualRemaining = leaveBalance
    ? Math.max(0, (leaveBalance.casual_leaves_entitled || 6) - leaveBalance.casual_leaves_used)
    : 6;

  const getLeaveTypeBadge = (leave: LeaveWithEmployee) => {
    const typeKey = leave.leave_type || (leave.is_emergency ? "emergency" : "casual");
    const config = LEAVE_TYPE_CONFIG[typeKey] || { label: typeKey, code: "PL", variant: "default" };
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label} [{config.code}]
      </Badge>
    );
  };

  const getStatusBadge = (leave: LeaveWithEmployee) => {
    if (leave.auto_rejected) {
      return <Badge variant="destructive">Auto Rejected</Badge>;
    }
    switch (leave.status) {
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
  };

  // Filter Logic
  const filteredLeaves = leaves.filter((leave) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = leave.employee_name?.toLowerCase().includes(q);
      const reasonMatch = leave.reason.toLowerCase().includes(q);
      if (!nameMatch && !reasonMatch) return false;
    }

    if (statusFilter !== "all") {
      if (statusFilter === "pending" && (leave.status !== "pending" || leave.auto_rejected)) return false;
      if (statusFilter === "approved" && leave.status !== "approved") return false;
      if (statusFilter === "rejected" && leave.status !== "rejected" && !leave.auto_rejected) return false;
    }

    if (typeFilter !== "all") {
      if (leave.leave_type !== typeFilter) return false;
    }

    if (startDateFilter && leave.start_date < startDateFilter) return false;
    if (endDateFilter && leave.end_date > endDateFilter) return false;

    return true;
  });

  const totalFiltered = filteredLeaves.length;
  const pendingFiltered = filteredLeaves.filter((l) => l.status === "pending" && !l.auto_rejected).length;
  const approvedFiltered = filteredLeaves.filter((l) => l.status === "approved").length;
  const rejectedFiltered = filteredLeaves.filter((l) => l.status === "rejected" || l.auto_rejected).length;

  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilter !== "all" || startDateFilter || endDateFilter;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  // Reusable Filter Bar Component
  const renderFilterBar = () => (
    <div className="bg-card border rounded-lg p-4 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Filter Leave Requests</span>
        </div>

        {/* Counts Summary */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-slate-50 text-xs">
            Total: <strong className="ml-1 text-foreground">{totalFiltered}</strong>
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
            Pending: <strong className="ml-1">{pendingFiltered}</strong>
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 text-xs">
            Approved: <strong className="ml-1">{approvedFiltered}</strong>
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 text-xs">
            Rejected: <strong className="ml-1">{rejectedFiltered}</strong>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isManagerOrAdmin ? "Search employee / reason..." : "Search reason..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All Leave Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leave Types</SelectItem>
            <SelectItem value="casual">Casual Leave</SelectItem>
            <SelectItem value="medical">Medical Leave</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="lop">LOP</SelectItem>
            <SelectItem value="half_day">Half Day</SelectItem>
          </SelectContent>
        </Select>

        {/* Start Date */}
        <Input
          type="date"
          value={startDateFilter}
          onChange={(e) => setStartDateFilter(e.target.value)}
          className="h-9 text-xs"
        />

        {/* End Date */}
        <Input
          type="date"
          value={endDateFilter}
          onChange={(e) => setEndDateFilter(e.target.value)}
          className="h-9 text-xs"
        />
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Clear Filters
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leaves</h1>
            <p className="text-muted-foreground">Manage leave requests, documents, and clarifications</p>
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
          </div>
        )}

        {/* Collapsible Company Leave Rules Box - Employee Only */}
        {!isManagerOrAdmin && (
          <Collapsible open={showRules} onOpenChange={setShowRules} className="w-full">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full flex items-center justify-between bg-card hover:bg-slate-50 p-3 border rounded-lg shadow-sm h-auto"
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs sm:text-sm">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>Company Leave Rules & Policies</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {showRules ? "Hide Rules ▲" : "View Rules 🔽"}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showRules ? "rotate-180" : ""}`} />
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <EmployeeLeaveRulesView />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Manager/Admin View */}
        {isManagerOrAdmin ? (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Requests</TabsTrigger>
              <TabsTrigger value="balance">Leave Balance</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {/* Filter controls rendered ONLY inside All Requests tab */}
              {renderFilterBar()}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">All Leave Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredLeaves.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave requests found matching filters
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Dates (range)</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLeaves.map((leave) => (
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
                                {leave.document_url && (
                                  <a
                                    href={leave.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 font-medium"
                                  >
                                    <FileText className="h-3 w-3" />
                                    {leave.document_name || "Attachment"}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                                {leave.auto_rejection_reason && (
                                  <div className="text-xs text-destructive mt-1">{leave.auto_rejection_reason}</div>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(leave)}</TableCell>
                              <TableCell className="text-right flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                  title="Clarification Chat"
                                  onClick={() => openChatDialog(leave)}
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Chat</span>
                                </Button>

                                {leave.status === "pending" && !leave.auto_rejected ? (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => openApprovalDialog(leave)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Review
                                  </Button>
                                ) : leave.end_date >= new Date().toISOString().split("T")[0] ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                                    title="Undo Decision (Reset to Pending)"
                                    onClick={() => handleUndo(leave.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Undo</span>
                                  </Button>
                                ) : null}
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

            <TabsContent value="balance">
              <AdminLeaveBalance />
            </TabsContent>
          </Tabs>
        ) : (
          /* Employee View */
          <div className="space-y-4">
            {renderFilterBar()}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">My Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredLeaves.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No leave requests found matching filters
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dates (range)</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeaves.map((leave) => (
                          <TableRow key={leave.id} className={leave.auto_rejected ? "bg-destructive/5" : ""}>
                            <TableCell>
                              <div className="text-sm font-medium">
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
                              {leave.document_url && (
                                <a
                                  href={leave.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 font-medium"
                                >
                                  <FileText className="h-3 w-3" />
                                  {leave.document_name || "Attachment"}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {leave.auto_rejection_reason && (
                                <div className="text-xs text-destructive mt-1">{leave.auto_rejection_reason}</div>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(leave)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => openChatDialog(leave)}
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                Chat / Clarify
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
          leaveBalancesUsed={
            leaveBalance
              ? {
                  casual: leaveBalance.casual_leaves_used,
                  medical: leaveBalance.medical_leaves_used,
                  emergency: leaveBalance.emergency_leaves_used,
                  lop: leaveBalance.lop_leaves_used,
                  half_day: leaveBalance.half_day_leaves_used,
                }
              : undefined
          }
          leaveBalancesEntitled={
            leaveBalance
              ? {
                  casual: leaveBalance.casual_leaves_entitled || 6,
                  medical: leaveBalance.medical_leaves_entitled || 6,
                  emergency: leaveBalance.emergency_leaves_entitled || 6,
                  lop: leaveBalance.lop_leaves_entitled || 6,
                  half_day: leaveBalance.half_day_leaves_entitled || 6,
                }
              : undefined
          }
        />
      )}

      {/* Leave Approval Dialog */}
      <LeaveApprovalDialog
        leave={selectedLeave}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onUndo={handleUndo}
      />

      {/* Leave Clarification Continuous Chat Dialog */}
      <LeaveChatDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        leave={chatLeave}
        currentUserId={user?.id || ""}
      />
    </DashboardLayout>
  );
}
