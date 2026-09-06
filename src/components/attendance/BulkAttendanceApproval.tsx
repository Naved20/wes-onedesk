import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle, Edit } from "lucide-react";

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: "pending" | "approved" | "rejected" | null;
  is_late: boolean | null;
  is_half_day: boolean | null;
  half_day_type: string | null;
  notes: string | null;
  employee_name?: string;
}

interface BulkAttendanceApprovalProps {
  records: AttendanceRecord[];
  onUpdate: () => void;
  userId: string;
}

export function BulkAttendanceApproval({ records, onUpdate, userId }: BulkAttendanceApprovalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(records.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one record to approve",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedIds.length} attendance record(s) approved`,
      });
      setSelectedIds([]);
      onUpdate();
    } catch (error) {
      console.error("Error approving attendance:", error);
      toast({
        title: "Error",
        description: "Failed to approve attendance records",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedIds.length} attendance record(s) rejected`,
      });
      setSelectedIds([]);
      setRejectionReason("");
      setRejectDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error rejecting attendance:", error);
      toast({
        title: "Error",
        description: "Failed to reject attendance records",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (record: AttendanceRecord) => {
    setEditRecord(record);
    setEditStatus(record.status || "pending");
    setEditDialogOpen(true);
  };

  const handleStatusChange = async () => {
    if (!editRecord) return;

    setIsSubmitting(true);
    try {
      const updateData: Record<string, unknown> = {
        status: editStatus,
        modified_by: userId,
        modified_at: new Date().toISOString(),
      };

      if (editStatus === "approved") {
        updateData.approved_by = userId;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("attendance")
        .update(updateData)
        .eq("id", editRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance status updated successfully",
      });
      setEditDialogOpen(false);
      setEditRecord(null);
      onUpdate();
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-muted-foreground text-center">
            All caught up! No pending attendance to review.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Pending Attendance ({records.length})
            </CardTitle>
            {selectedIds.length > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject ({selectedIds.length})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === records.length && records.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(record.id)}
                      onCheckedChange={(checked) => handleSelectOne(record.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{record.employee_name || "-"}</TableCell>
                  <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    {record.check_in_time
                      ? format(new Date(record.check_in_time), "hh:mm a")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {record.check_out_time ? (
                      format(new Date(record.check_out_time), "hh:mm a")
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Missing</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {record.is_half_day && <Badge variant="secondary">Half</Badge>}
                      {record.is_late && (
                        <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400">
                          Late
                        </Badge>
                      )}
                      {!record.is_half_day && !record.is_late && <Badge>Full Day</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.status === "approved" && <Badge className="bg-green-500">Approved</Badge>}
                    {record.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                    {record.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(record)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Attendance Records</DialogTitle>
            <DialogDescription>
              You are about to reject {selectedIds.length} attendance record(s). Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              Reject Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Attendance Status</DialogTitle>
            <DialogDescription>
              {editRecord && (
                <>
                  {editRecord.employee_name} - {format(new Date(editRecord.date), "MMM dd, yyyy")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={isSubmitting}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
