import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, FileText, ExternalLink, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { leaveNotifications } from "@/lib/notificationService";

interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  is_half_day: boolean;
  half_day_type?: string;
  is_emergency: boolean;
  working_days_count: number;
  salary_deduction_percent: number;
  auto_rejected: boolean;
  auto_rejection_reason?: string;
  document_url?: string | null;
  document_name?: string | null;
  status?: string | null;
}

interface LeaveApprovalDialogProps {
  leave: LeaveRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onUndo?: (id: string) => Promise<void>;
}

export function LeaveApprovalDialog({
  leave,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onUndo,
}: LeaveApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState<"approve" | "reject" | "undo" | null>(null);
  const [casualLeaveNumber, setCasualLeaveNumber] = useState<number | null>(null);
  const [loadingLeaveCount, setLoadingLeaveCount] = useState(false);

  useEffect(() => {
    if (leave && leave.leave_type === "casual" && open) {
      fetchCasualLeaveCount();
    } else {
      setCasualLeaveNumber(null);
    }
  }, [leave, open]);

  const fetchCasualLeaveCount = async () => {
    if (!leave) return;

    setLoadingLeaveCount(true);
    try {
      const leaveDate = new Date(leave.start_date);
      const month = leaveDate.getMonth() + 1;
      const year = leaveDate.getFullYear();

      const { data, error } = await supabase
        .from("leaves")
        .select("id")
        .eq("user_id", leave.user_id)
        .eq("leave_type", "casual")
        .eq("status", "approved")
        .gte("start_date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lt("start_date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`);

      if (error) throw error;

      setCasualLeaveNumber((data?.length || 0) + 1);
    } catch (error) {
      console.error("Error fetching casual leave count:", error);
      setCasualLeaveNumber(null);
    } finally {
      setLoadingLeaveCount(false);
    }
  };

  if (!leave) return null;

  const handleApprove = async () => {
    setProcessing("approve");
    try {
      const { error } = await supabase
        .from("leaves")
        .update({ status: "approved" })
        .eq("id", leave.id);

      if (error) throw error;

      await leaveNotifications.approved(
        leave.user_id,
        leave.leave_type || "leave",
        format(new Date(leave.start_date), "MMM dd, yyyy")
      );

      toast({ title: "Approved", description: "Leave approved successfully" });
      onOpenChange(false);
      await onApprove(leave.id);
    } catch (error) {
      console.error("Error approving leave:", error);
      toast({
        title: "Error",
        description: "Failed to approve leave",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    setProcessing("reject");
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", leave.id);

      if (error) throw error;

      await leaveNotifications.rejected(
        leave.user_id,
        leave.leave_type || "leave",
        rejectionReason.trim()
      );

      toast({ title: "Rejected", description: "Leave rejected successfully" });
      setRejectionReason("");
      onOpenChange(false);
      await onReject(leave.id, rejectionReason.trim());
    } catch (error) {
      console.error("Error rejecting leave:", error);
      toast({
        title: "Error",
        description: "Failed to reject leave",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleUndo = async () => {
    setProcessing("undo");
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: "pending",
          auto_rejected: false,
          auto_rejection_reason: null,
          rejection_reason: null,
        })
        .eq("id", leave.id);

      if (error) throw error;

      toast({ title: "Undo Successful", description: "Leave request status reset to Pending" });
      onOpenChange(false);
      if (onUndo) {
        await onUndo(leave.id);
      }
    } catch (error) {
      console.error("Error undoing leave decision:", error);
      toast({
        title: "Error",
        description: "Failed to undo leave decision",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getLeaveTypeBadge = () => {
    const type = leave.leave_type || "casual";
    if (type === "emergency" && leave.salary_deduction_percent === 100) {
      return (
        <Badge variant="outline" className="border-red-500 text-red-600">
          Emergency (Deduction)
        </Badge>
      );
    }
    switch (type) {
      case "casual":
        return <Badge variant="default">Casual</Badge>;
      case "sick":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Sick
          </Badge>
        );
      case "medical":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Medical (Paid)
          </Badge>
        );
      case "emergency":
        return (
          <Badge variant="outline" className="border-red-500 text-red-600">
            Emergency
          </Badge>
        );
      case "lop":
        return <Badge variant="destructive">LOP</Badge>;
      case "half_day":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Half Day
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getSalaryImpactText = () => {
    const type = leave.leave_type || "casual";
    if (type === "casual" || type === "medical" || type === "sick") {
      return { text: "No salary deduction (Paid Leave)", color: "text-green-600" };
    }
    if (type === "half_day") {
      return { text: "0.5 day salary deduction", color: "text-amber-600" };
    }
    return { text: "100% salary deduction for leave days", color: "text-red-600" };
  };

  const salaryImpact = getSalaryImpactText();
  const isCasualLeave = leave.leave_type === "casual";
  const isSingleDay = (leave.working_days_count || 1) <= 1;
  const isDecided = leave.status === "approved" || leave.status === "rejected" || leave.auto_rejected;

  const todayStr = new Date().toISOString().split("T")[0];
  const isFutureOrCurrent = leave.end_date >= todayStr;
  const canUndo = isDecided && isFutureOrCurrent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Review Leave Request</span>
            {leave.auto_rejected && (
              <Badge variant="destructive" className="text-xs">
                Auto-Rejected
              </Badge>
            )}
            {leave.status === "approved" && (
              <Badge variant="default" className="bg-green-600 text-xs">
                Approved
              </Badge>
            )}
            {leave.status === "rejected" && !leave.auto_rejected && (
              <Badge variant="destructive" className="text-xs">
                Rejected
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review details for {leave.employee_name || "Employee"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Auto Rejection Alert */}
          {leave.auto_rejected && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Auto-Rejection Notice</p>
                <p className="text-xs mt-0.5">
                  {leave.auto_rejection_reason || "Violates company leave rules"}
                </p>
              </div>
            </div>
          )}

          {/* Casual Leave Multi-Day Warning */}
          {isCasualLeave && !isSingleDay && !isDecided && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Policy Violation Warning</p>
                <p className="text-xs mt-0.5">
                  Casual leave can only be taken 1 day at a time. Multi-day casual leave cannot be approved.
                </p>
              </div>
            </div>
          )}

          {/* Leave Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Leave Type</Label>
              <div className="mt-1 flex items-center gap-2">
                {getLeaveTypeBadge()}
                {isCasualLeave && isSingleDay && (
                  <Badge variant="outline" className="text-xs">1 day</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Duration</Label>
              <p className="font-medium">
                {leave.working_days_count || 1} day(s)
                {leave.is_half_day && ` (${leave.half_day_type === "first_half" ? "Morning" : "Afternoon"})`}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Start Date</Label>
              <p className="font-medium">{format(new Date(leave.start_date), "PPP")}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">End Date</Label>
              <p className="font-medium">{format(new Date(leave.end_date), "PPP")}</p>
            </div>
          </div>

          {/* Salary Impact */}
          <div className="bg-muted p-3 rounded-lg">
            <Label className="text-muted-foreground">Salary Impact</Label>
            <p className={`font-medium ${salaryImpact.color}`}>{salaryImpact.text}</p>
          </div>

          {/* Emergency Flag */}
          {leave.is_emergency && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Marked as Emergency</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label className="text-muted-foreground">Reason</Label>
            <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{leave.reason}</p>
          </div>

          {/* Attached Document */}
          {leave.document_url && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
              <Label className="text-blue-900 text-xs font-semibold">Submitted Supporting Document</Label>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800 flex items-center gap-1.5 truncate">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  {leave.document_name || "Leave Attachment"}
                </span>
                <a
                  href={leave.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline font-semibold shrink-0"
                >
                  View in Drive <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Rejection Reason Input if pending */}
          {!isDecided && (
            <div>
              <Label>Rejection Reason (required for rejection)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide reason if rejecting..."
                rows={2}
                className="mt-1"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!processing}>
            Cancel
          </Button>

          {canUndo ? (
            <Button
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={handleUndo}
              disabled={!!processing}
            >
              {processing === "undo" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RotateCcw className="mr-2 h-4 w-4 text-amber-600" />
              Undo Decision (Reset to Pending)
            </Button>
          ) : !isDecided ? (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!!processing || !rejectionReason.trim()}
              >
                {processing === "reject" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!!processing || leave.auto_rejected || (isCasualLeave && !isSingleDay)}
              >
                {processing === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}