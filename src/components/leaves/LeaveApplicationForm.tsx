import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format, addDays, isSunday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { leaveNotifications } from "@/lib/notificationService";

type LeaveType = "casual" | "sick" | "unplanned" | "emergency";

interface LeaveApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  casualLeavesRemaining: number;
}

export function LeaveApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  userId,
  casualLeavesRemaining,
}: LeaveApplicationFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<"first_half" | "second_half">("first_half");
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: "error" | "warning" | "info"; message: string } | null>(null);
  const [workingDays, setWorkingDays] = useState(0);

  // For casual leave, auto-sync end date with start date (single day only)
  useEffect(() => {
    if (leaveType === "casual" && startDate) {
      setEndDate(startDate);
    }
  }, [leaveType, startDate]);

  // Calculate working days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      calculateWorkingDays();
    }
  }, [startDate, endDate, isHalfDay]);

  const calculateWorkingDays = async () => {
    if (!startDate || !endDate) return;

    try {
      const { data, error } = await supabase.rpc("calculate_working_days", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw error;
      
      const days = isHalfDay ? 0.5 : (data || 0);
      setWorkingDays(days);
    } catch (err) {
      console.error("Error calculating working days:", err);
      // Fallback calculation
      const start = new Date(startDate);
      const end = new Date(endDate);
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        if (!isSunday(current)) count++;
        current.setDate(current.getDate() + 1);
      }
      setWorkingDays(isHalfDay ? 0.5 : count);
    }
  };

  // Validate leave request
  useEffect(() => {
    validateLeave();
  }, [startDate, endDate, leaveType, isEmergency, workingDays, casualLeavesRemaining]);

  const validateLeave = () => {
    if (!startDate) {
      setValidationMessage(null);
      return;
    }

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const advanceDays = differenceInDays(start, today);

    // Check for Sundays
    if (isSunday(start)) {
      setValidationMessage({
        type: "error",
        message: "Leave cannot start on a Sunday",
      });
      return;
    }

    // Casual leave validations
    if (leaveType === "casual") {
      // Check if quota exhausted
      if (casualLeavesRemaining <= 0) {
        setValidationMessage({
          type: "error",
          message: "You have used all 2 casual leaves this month (0 remaining)",
        });
        return;
      }

      // Multi-day validation (should not happen with UI restrictions, but safety check)
      if (startDate !== endDate) {
        setValidationMessage({
          type: "error",
          message: "Casual leaves are limited to exactly 1 day per application",
        });
        return;
      }

      // 3-day advance notice (unless emergency)
      if (!isEmergency && advanceDays < 3) {
        setValidationMessage({
          type: "error",
          message: "Casual leaves require minimum 3 days advance notice",
        });
        return;
      }

      // Show info about remaining leaves
      if (casualLeavesRemaining === 1) {
        setValidationMessage({
          type: "warning",
          message: "This is your last casual leave for this month (1/2 remaining)",
        });
        return;
      }
    }

    // Sick leave warning
    if (leaveType === "sick") {
      setValidationMessage({
        type: "warning",
        message: "Sick leave requires medical proof and has 50% salary deduction",
      });
      return;
    }

    // Unplanned leave warning
    if (leaveType === "unplanned") {
      setValidationMessage({
        type: "warning",
        message: "Unplanned leave has 100% salary deduction",
      });
      return;
    }

    // Emergency info
    if (isEmergency) {
      setValidationMessage({
        type: "info",
        message: "Emergency leave bypasses advance notice requirement",
      });
      return;
    }

    setValidationMessage(null);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      return;
    }

    // Final validation for casual leave
    if (leaveType === "casual" && startDate !== endDate) {
      setValidationMessage({
        type: "error",
        message: "Casual leaves must be single-day only",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("leaves").insert({
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        leave_type: leaveType,
        is_half_day: isHalfDay,
        half_day_type: isHalfDay ? halfDayType : null,
        is_emergency: isEmergency,
      });

      if (error) throw error;

      // Send notification to employee
      const workingDaysDisplay = isHalfDay ? "0.5" : String(workingDays);
      await leaveNotifications.applied(
        userId,
        leaveType,
        parseInt(workingDaysDisplay) || 1,
        format(new Date(startDate), "MMM dd, yyyy")
      );

      onSuccess();
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error submitting leave:", err);
      setValidationMessage({
        type: "error",
        message: err.message || "Failed to submit leave application",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setReason("");
    setLeaveType("casual");
    setIsHalfDay(false);
    setHalfDayType("first_half");
    setIsEmergency(false);
    setValidationMessage(null);
    setWorkingDays(0);
  };

  const getSalaryImpact = () => {
    switch (leaveType) {
      case "casual":
      case "emergency":
        return "No deduction (within limit)";
      case "sick":
        return "50% salary deduction";
      case "unplanned":
        return "100% salary deduction";
      default:
        return "";
    }
  };

  const minStartDate = format(addDays(new Date(), leaveType === "casual" && !isEmergency ? 3 : 0), "yyyy-MM-dd");

  const isCasualLeave = leaveType === "casual";
  const isFormDisabled = isCasualLeave && casualLeavesRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {isCasualLeave ? (
              <span>
                Casual leaves: <Badge variant={casualLeavesRemaining > 0 ? "secondary" : "destructive"}>{casualLeavesRemaining}/2 remaining</Badge>
                <span className="text-xs ml-2">(1 day per application)</span>
              </span>
            ) : (
              "Fill in the details for your leave request"
            )}
          </DialogDescription>
        </DialogHeader>

        {isFormDisabled && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have exhausted your casual leave quota (2/2 used). Please choose a different leave type.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          {/* Leave Type */}
          <div className="grid gap-2">
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual" disabled={casualLeavesRemaining <= 0}>
                  Casual Leave (No deduction) {casualLeavesRemaining <= 0 && "- Limit reached"}
                </SelectItem>
                <SelectItem value="sick">Sick Leave (50% deduction)</SelectItem>
                <SelectItem value="unplanned">Unplanned Leave (100% deduction)</SelectItem>
                <SelectItem value="emergency">Emergency Leave</SelectItem>
              </SelectContent>
            </Select>
            {isCasualLeave && (
              <p className="text-xs text-muted-foreground">
                ⓘ Casual leaves are limited to exactly 1 day per application
              </p>
            )}
          </div>

          {/* Emergency Checkbox - only for casual */}
          {leaveType === "casual" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emergency"
                checked={isEmergency}
                onCheckedChange={(checked) => setIsEmergency(checked === true)}
                disabled={isFormDisabled}
              />
              <Label htmlFor="emergency" className="text-sm">
                Mark as emergency (bypasses 3-day notice requirement)
              </Label>
            </div>
          )}

          {/* Date Selection */}
          {isCasualLeave ? (
            // Single date picker for casual leave
            <div className="grid gap-2">
              <Label>Leave Date (Single Day Only)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value); // Auto-sync for casual
                }}
                min={minStartDate}
                disabled={isFormDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Casual leaves can only be applied for 1 day at a time
              </p>
            </div>
          ) : (
            // Date range for other leave types
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  min={minStartDate}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || minStartDate}
                />
              </div>
            </div>
          )}

          {/* Half Day Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="halfDay"
              checked={isHalfDay}
              onCheckedChange={(checked) => setIsHalfDay(checked === true)}
              disabled={isFormDisabled || (!isCasualLeave && startDate !== endDate)}
            />
            <Label htmlFor="halfDay" className="text-sm">
              Half day leave {!isCasualLeave && startDate !== endDate && "(only for single day)"}
            </Label>
          </div>

          {isHalfDay && (
            <Select value={halfDayType} onValueChange={(v) => setHalfDayType(v as "first_half" | "second_half")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_half">First Half (Morning)</SelectItem>
                <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Working Days Display */}
          {workingDays > 0 && (
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              Duration: <strong>{workingDays} day{workingDays !== 1 ? 's' : ''}</strong> | Salary impact: <strong>{getSalaryImpact()}</strong>
            </div>
          )}

          {/* Reason */}
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for your leave..."
              rows={3}
              disabled={isFormDisabled}
            />
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <Alert variant={validationMessage.type === "error" ? "destructive" : "default"}>
              {validationMessage.type === "error" && <AlertTriangle className="h-4 w-4" />}
              {validationMessage.type === "warning" && <AlertTriangle className="h-4 w-4" />}
              {validationMessage.type === "info" && <Info className="h-4 w-4" />}
              <AlertDescription>{validationMessage.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              isFormDisabled ||
              !startDate ||
              !endDate ||
              !reason.trim() ||
              validationMessage?.type === "error"
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}