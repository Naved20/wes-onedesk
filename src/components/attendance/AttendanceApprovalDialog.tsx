import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertTriangle, Shield, Edit } from "lucide-react";

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  status: string | null;
  calculated_status?: string | null;
  is_half_day: boolean | null;
  half_day_type: string | null;
  is_late: boolean | null;
  notes: string | null;
  employee_name?: string;
}

interface AttendanceApprovalDialogProps {
  attendance: AttendanceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  userId: string;
  isAdmin: boolean;
}

export function AttendanceApprovalDialog({
  attendance,
  isOpen,
  onClose,
  onUpdate,
  userId,
  isAdmin,
}: AttendanceApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    check_in_time: "",
    status: "",
    calculated_status: "",
    is_late: false,
    is_half_day: false,
    half_day_type: "",
    notes: "",
  });

  useEffect(() => {
    if (attendance) {
      setEditData({
        check_in_time: attendance.check_in_time 
          ? format(new Date(attendance.check_in_time), "HH:mm")
          : "",
        status: attendance.status || "pending",
        calculated_status: attendance.calculated_status || "present",
        is_late: attendance.is_late || false,
        is_half_day: attendance.is_half_day || false,
        half_day_type: attendance.half_day_type || "",
        notes: attendance.notes || "",
      });
    }
  }, [attendance]);

  if (!attendance) return null;

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          admin_override: adminOverride,
          modified_by: adminOverride ? userId : null,
        })
        .eq("id", attendance.id);

      if (error) throw error;

      toast({ title: "Approved", description: "Attendance approved successfully" });
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error approving:", error);
      toast({
        title: "Error",
        description: "Failed to approve attendance",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim(),
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", attendance.id);

      if (error) throw error;

      toast({ title: "Rejected", description: "Attendance rejected" });
      setRejectionReason("");
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({
        title: "Error",
        description: "Failed to reject attendance",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminEdit = async () => {
    setSubmitting(true);
    try {
      const checkInDateTime = attendance.date && editData.check_in_time
        ? new Date(`${attendance.date}T${editData.check_in_time}:00`).toISOString()
        : null;

      const { error } = await supabase
        .from("attendance")
        .update({
          check_in_time: checkInDateTime,
          status: editData.status,
          calculated_status: editData.calculated_status,
          is_late: editData.is_late,
          is_half_day: editData.is_half_day,
          half_day_type: editData.is_half_day ? editData.half_day_type : null,
          notes: editData.notes || null,
          is_manual_override: true,
          modified_by: userId,
          modified_at: new Date().toISOString(),
        })
        .eq("id", attendance.id);

      if (error) throw error;

      toast({ title: "Success", description: "Attendance updated successfully" });
      setEditMode(false);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderReviewContent = () => (
    <>
      <div className="p-4 rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">Employee</p>
        <p className="font-semibold text-lg">{attendance.employee_name || "Unknown"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="font-medium">{format(new Date(attendance.date), "MMM dd, yyyy")}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Check-in Time</p>
          <p className="font-medium">
            {attendance.check_in_time
              ? format(new Date(attendance.check_in_time), "hh:mm a")
              : "-"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {attendance.is_half_day && (
          <Badge variant="secondary">
            Half Day ({attendance.half_day_type === "first_half" ? "Morning" : "Afternoon"})
          </Badge>
        )}
        {attendance.is_late && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Late Check-in
          </Badge>
        )}
      </div>

      {attendance.notes && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Notes</p>
          <p className="text-sm p-3 rounded-lg bg-muted">{attendance.notes}</p>
        </div>
      )}

      {attendance.is_late && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Late Check-in Flagged</p>
            <p className="text-sm text-muted-foreground">
              This employee checked in late
            </p>
          </div>
        </div>
      )}

      {isAdmin && attendance.status !== "approved" && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <Label htmlFor="admin-override" className="cursor-pointer">
              Admin Override
            </Label>
          </div>
          <Switch
            id="admin-override"
            checked={adminOverride}
            onCheckedChange={setAdminOverride}
          />
        </div>
      )}

      {attendance.status === "pending" && (
        <div className="space-y-2">
          <Label htmlFor="rejection-reason">Rejection Reason</Label>
          <Textarea
            id="rejection-reason"
            placeholder="Required if rejecting..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
          />
        </div>
      )}
    </>
  );

  const renderEditContent = () => (
    <>
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-primary" />
          <p className="font-medium text-primary">Admin Edit Mode</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Changes will be marked as manual override
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input value={format(new Date(attendance.date), "MMM dd, yyyy")} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="check_in_time">Check-in Time</Label>
          <Input
            id="check_in_time"
            type="time"
            value={editData.check_in_time}
            onChange={(e) => setEditData({ ...editData, check_in_time: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Approval Status</Label>
          <Select value={editData.status} onValueChange={(value) => setEditData({ ...editData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="calculated_status">Attendance Status</Label>
          <Select value={editData.calculated_status} onValueChange={(value) => setEditData({ ...editData, calculated_status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="present">Present (PR)</SelectItem>
              <SelectItem value="late">Late (PR + LT)</SelectItem>
              <SelectItem value="half_day">Half Day (HD)</SelectItem>
              <SelectItem value="absent">Absent (AB)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg border">
        <Label htmlFor="is_late" className="cursor-pointer">Mark as Late</Label>
        <Switch
          id="is_late"
          checked={editData.is_late}
          onCheckedChange={(checked) => setEditData({ ...editData, is_late: checked })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <Label htmlFor="is_half_day" className="cursor-pointer">Half Day</Label>
          <Switch
            id="is_half_day"
            checked={editData.is_half_day}
            onCheckedChange={(checked) => setEditData({ ...editData, is_half_day: checked })}
          />
        </div>

        {editData.is_half_day && (
          <div className="space-y-2">
            <Label htmlFor="half_day_type">Half Day Type</Label>
            <Select value={editData.half_day_type} onValueChange={(value) => setEditData({ ...editData, half_day_type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_half">First Half (Morning)</SelectItem>
                <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={editData.notes}
          onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
          rows={3}
          placeholder="Add any notes..."
        />
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {editMode ? "Edit Attendance" : "Review Attendance"}
          </DialogTitle>
          <DialogDescription>
            {editMode ? "Modify attendance details" : "Review and approve/reject attendance"}
          </DialogDescription>
        </DialogHeader>

        {isAdmin && !editMode ? (
          <Tabs defaultValue="review" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="edit" onClick={() => setEditMode(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="space-y-4 mt-4">
              {renderReviewContent()}
            </TabsContent>
          </Tabs>
        ) : editMode ? (
          <div className="space-y-4 mt-4">
            {renderEditContent()}
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {renderReviewContent()}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdminEdit} disabled={submitting}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : attendance.status === "pending" ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
