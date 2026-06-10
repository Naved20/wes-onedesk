import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { leaveNotifications } from "@/lib/notificationService";

interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string | null;
  is_half_day: boolean | null;
  working_days_count: number | null;
  employee_name?: string;
}

interface BulkLeaveApprovalProps {
  pendingLeaves: LeaveRequest[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onBulkApprove: (ids: string[]) => Promise<void>;
  onBulkReject: (ids: string[], reason: string) => Promise<void>;
}

export function BulkLeaveApproval({
  pendingLeaves,
  selectedIds,
  onSelectionChange,
  onBulkApprove,
  onBulkReject,
}: BulkLeaveApprovalProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const allSelected = pendingLeaves.length > 0 && selectedIds.length === pendingLeaves.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < pendingLeaves.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(pendingLeaves.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    try {
      await onBulkApprove(selectedIds);

      // Send approval notifications to all affected employees
      for (const leave of pendingLeaves.filter(l => selectedIds.includes(l.id))) {
        await leaveNotifications.approved(
          leave.user_id,
          leave.leave_type || "leave",
          format(new Date(leave.start_date), "MMM dd, yyyy")
        ).catch(err => console.error("Failed to send notification:", err));
      }

      onSelectionChange([]);
      toast({
        title: "Bulk Approval Complete",
        description: `${selectedIds.length} leave request(s) approved successfully.`,
      });
    } catch (error) {
      console.error("Bulk approve error:", error);
      toast({
        title: "Error",
        description: "Failed to approve some leave requests.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0 || !rejectionReason.trim()) return;
    setProcessing(true);
    try {
      await onBulkReject(selectedIds, rejectionReason);

      // Send rejection notifications to all affected employees
      for (const leave of pendingLeaves.filter(l => selectedIds.includes(l.id))) {
        await leaveNotifications.rejected(
          leave.user_id,
          leave.leave_type || "leave",
          rejectionReason
        ).catch(err => console.error("Failed to send notification:", err));
      }

      onSelectionChange([]);
      setRejectionReason("");
      setRejectDialogOpen(false);
      toast({
        title: "Bulk Rejection Complete",
        description: `${selectedIds.length} leave request(s) rejected.`,
      });
    } catch (error) {
      console.error("Bulk reject error:", error);
      toast({
        title: "Error",
        description: "Failed to reject some leave requests.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getLeaveTypeBadge = (type: string | null) => {
    switch (type) {
      case "casual":
        return <Badge variant="outline">Casual</Badge>;
      case "sick":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Sick</Badge>;
      case "unplanned":
        return <Badge variant="destructive">Unplanned</Badge>;
      case "emergency":
        return <Badge variant="outline" className="border-red-500 text-red-600">Emergency</Badge>;
      default:
        return <Badge variant="outline">{type || "Unknown"}</Badge>;
    }
  };

  if (pendingLeaves.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            ref={(el) => {
              if (el) {
                (el as unknown as HTMLInputElement).indeterminate = someSelected;
              }
            }}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            {selectedIds.length === 0
              ? `${pendingLeaves.length} pending requests`
              : `${selectedIds.length} of ${pendingLeaves.length} selected`}
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleBulkApprove}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Approve ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* Pending Leaves Table with Checkboxes */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingLeaves.map((leave) => (
              <TableRow
                key={leave.id}
                className={selectedIds.includes(leave.id) ? "bg-primary/5" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(leave.id)}
                    onCheckedChange={() => toggleSelect(leave.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {leave.employee_name || "Unknown"}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(leave.start_date), "MMM dd")} -{" "}
                    {format(new Date(leave.end_date), "MMM dd, yyyy")}
                  </div>
                </TableCell>
                <TableCell>
                  {leave.working_days_count || 1}
                  {leave.is_half_day && " (half)"}
                </TableCell>
                <TableCell>{getLeaveTypeBadge(leave.leave_type)}</TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="truncate" title={leave.reason}>
                    {leave.reason}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reject {selectedIds.length} Leave Request(s)
            </DialogTitle>
            <DialogDescription>
              This will reject all selected leave requests with the same reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason (required)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
