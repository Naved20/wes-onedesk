import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type LeaveType = "casual" | "medical" | "emergency" | "lop" | "half_day";

// Leave policy configuration matching the new policy table
const LEAVE_POLICY: Record<LeaveType, {
  label: string;
  code: string;
  advanceDays: number;
  maxDaysAtTime: number;
  balance: number;
  salaryImpact: string;
  salaryImpactShort: string;
  proofSubmission: string;
  purpose: string;
}> = {
  casual: {
    label: "Casual Leave",
    code: "PL",
    advanceDays: 4,
    maxDaysAtTime: 2,
    balance: 6,
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Planned personal work or short planned absence",
  },
  medical: {
    label: "Medical Leave",
    code: "PL",
    advanceDays: 0,
    maxDaysAtTime: 2,
    balance: 6,
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Planned leave earned after qualifying service period",
  },
  emergency: {
    label: "Emergency Leave",
    code: "LE",
    advanceDays: 0,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "After 2 Days",
    purpose: "Sudden unavoidable emergency",
  },
  lop: {
    label: "Leave Without Pay / LOP",
    code: "LE",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Unpaid leave or absence not covered under paid leave",
  },
  half_day: {
    label: "Half-Day Leave",
    code: "HD",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "0.5 LOP",
    salaryImpactShort: "Half day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Leave for half working day",
  },
};

interface LeaveBalances {
  casual: number;
  medical: number;
  emergency: number;
  lop: number;
  half_day: number;
}

interface LeaveApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  casualLeavesRemaining: number;
  leaveBalancesUsed?: LeaveBalances;
}

export function LeaveApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  userId,
  casualLeavesRemaining,
  leaveBalancesUsed,
}: LeaveApplicationFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [halfDayType, setHalfDayType] = useState<"first_half" | "second_half">("first_half");
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: "error" | "warning" | "info"; message: string } | null>(null);
  const [workingDays, setWorkingDays] = useState(0);

  const policy = LEAVE_POLICY[leaveType];

  // Get remaining balance for current leave type
  const getRemainingBalance = (type: LeaveType) => {
    if (!leaveBalancesUsed) return LEAVE_POLICY[type].balance;
    const used = leaveBalancesUsed[type] || 0;
    return Math.max(0, LEAVE_POLICY[type].balance - used);
  };

  const currentRemaining = getRemainingBalance(leaveType);

  // For single-day leave types, auto-sync end date with start date
  useEffect(() => {
    if ((policy.maxDaysAtTime === 1 || leaveType === "half_day") && startDate) {
      setEndDate(startDate);
    }
  }, [leaveType, startDate, policy.maxDaysAtTime]);

  // Calculate working days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      calculateWorkingDays();
    }
  }, [startDate, endDate, leaveType]);

  const calculateWorkingDays = async () => {
    if (!startDate || !endDate) return;

    try {
      const { data, error } = await supabase.rpc("calculate_working_days", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw error;

      const days = leaveType === "half_day" ? 0.5 : (data || 0);
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
      setWorkingDays(leaveType === "half_day" ? 0.5 : count);
    }
  };

  // Validate leave request
  useEffect(() => {
    validateLeave();
  }, [startDate, endDate, leaveType, workingDays, leaveBalancesUsed]);

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

    // Check balance
    if (currentRemaining <= 0) {
      setValidationMessage({
        type: "error",
        message: `You have used all ${policy.balance} ${policy.label} this month (0 remaining)`,
      });
      return;
    }

    // Check max days at a time
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let dayCount = 0;
      const current = new Date(start);
      while (current <= end) {
        if (!isSunday(current)) dayCount++;
        current.setDate(current.getDate() + 1);
      }
      if (dayCount > policy.maxDaysAtTime) {
        setValidationMessage({
          type: "error",
          message: `${policy.label} allows maximum ${policy.maxDaysAtTime} day(s) at a time`,
        });
        return;
      }
    }

    // Check advance notice
    if (advanceDays < policy.advanceDays) {
      setValidationMessage({
        type: "error",
        message: `${policy.label} requires minimum ${policy.advanceDays} days advance notice`,
      });
      return;
    }

    // Warning for last leave
    if (currentRemaining === 1) {
      setValidationMessage({
        type: "warning",
        message: `This is your last ${policy.label} for this month (1/${policy.balance} remaining)`,
      });
      return;
    }

    // Info for salary impact on non-paid leaves
    if (leaveType === "emergency") {
      setValidationMessage({
        type: "warning",
        message: `Emergency Leave: ${policy.salaryImpact} — Proof must be submitted within 2 days`,
      });
      return;
    }

    if (leaveType === "lop") {
      setValidationMessage({
        type: "warning",
        message: `Leave Without Pay: ${policy.salaryImpact} salary deduction`,
      });
      return;
    }

    if (leaveType === "half_day") {
      setValidationMessage({
        type: "info",
        message: `Half-Day Leave: ${policy.salaryImpact} salary deduction`,
      });
      return;
    }

    setValidationMessage(null);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const isHalfDay = leaveType === "half_day";

      const { error } = await supabase.from("leaves").insert({
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        leave_type: leaveType,
        is_half_day: isHalfDay,
        half_day_type: isHalfDay ? halfDayType : null,
        is_emergency: leaveType === "emergency",
      });

      if (error) throw error;

      // Send notification
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
    setHalfDayType("first_half");
    setValidationMessage(null);
    setWorkingDays(0);
  };

  const minStartDate = format(
    addDays(new Date(), policy.advanceDays),
    "yyyy-MM-dd"
  );

  const isSingleDayOnly = policy.maxDaysAtTime === 1;
  const isFormDisabled = currentRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {policy.label}:{" "}
              <Badge variant={currentRemaining > 0 ? "secondary" : "destructive"}>
                {currentRemaining}/{policy.balance} remaining
              </Badge>
              <Badge variant="outline" className="ml-1 text-xs">
                {policy.code}
              </Badge>
              {isSingleDayOnly && (
                <span className="text-xs ml-2">(Single day only)</span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        {isFormDisabled && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have exhausted your {policy.label} quota ({policy.balance}/{policy.balance} used). Please choose a different leave type.
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
                {Object.entries(LEAVE_POLICY).map(([key, config]) => {
                  const remaining = getRemainingBalance(key as LeaveType);
                  return (
                    <SelectItem key={key} value={key} disabled={remaining <= 0}>
                      {config.label} [{config.code}] ({remaining} left)
                      {remaining <= 0 && " — Limit reached"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>{policy.purpose}</span>
            </div>
          </div>

          {/* Date Selection */}
          {isSingleDayOnly ? (
            <div className="grid gap-2">
              <Label>Leave Date (Single Day Only)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                min={minStartDate}
                disabled={isFormDisabled}
              />
              <p className="text-xs text-muted-foreground">
                {policy.label} can only be applied for 1 day at a time
              </p>
            </div>
          ) : (
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
                  disabled={isFormDisabled}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || minStartDate}
                  disabled={isFormDisabled}
                />
              </div>
              <p className="text-xs text-muted-foreground col-span-2">
                Maximum {policy.maxDaysAtTime} days at a time
              </p>
            </div>
          )}

          {/* Half Day Type — only for half_day leave */}
          {leaveType === "half_day" && (
            <div className="grid gap-2">
              <Label>Half Day Type</Label>
              <Select value={halfDayType} onValueChange={(v) => setHalfDayType(v as "first_half" | "second_half")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_half">First Half (Morning)</SelectItem>
                  <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Working Days & Salary Impact Display */}
          {workingDays > 0 && (
            <div className="text-sm bg-muted p-3 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <strong>{workingDays} day{workingDays !== 1 ? "s" : ""}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary Impact:</span>
                <strong className={
                  leaveType === "casual" || leaveType === "medical"
                    ? "text-green-600"
                    : "text-amber-600"
                }>
                  {policy.salaryImpact}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proof Required:</span>
                <strong>{policy.proofSubmission}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leave Code:</span>
                <Badge variant="outline">{policy.code}</Badge>
              </div>
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