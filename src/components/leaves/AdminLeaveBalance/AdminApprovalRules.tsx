import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Info, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApprovalRules {
  approvalEnabled: boolean;
  autoApproveMedical: boolean;
  autoRejectMissingProof: boolean;
  proofSubmissionDeadline: number;
  employeeNotificationsEnabled: boolean;
  defaultApprovalStatus: "pending" | "auto_approved";
  allowAdminOverride: boolean;
  showApprovalConfirmation: boolean;
  rejectionReasonRequired: boolean;
}

const DEFAULT_APPROVAL_RULES: ApprovalRules = {
  approvalEnabled: true,
  autoApproveMedical: false,
  autoRejectMissingProof: true,
  proofSubmissionDeadline: 2,
  employeeNotificationsEnabled: true,
  defaultApprovalStatus: "pending",
  allowAdminOverride: true,
  showApprovalConfirmation: true,
  rejectionReasonRequired: true,
};

export function AdminApprovalRules() {
  const [rules, setRules] = useState<ApprovalRules>(DEFAULT_APPROVAL_RULES);
  const [saving, setSaving] = useState(false);

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      // In a real app, save to database
      toast({
        title: "Success",
        description: "Approval rules updated successfully.",
      });
    } catch (error) {
      console.error("Error saving rules:", error);
      toast({
        title: "Error",
        description: "Failed to save rules",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetRules = () => {
    setRules(DEFAULT_APPROVAL_RULES);
    toast({
      title: "Reset",
      description: "Rules reset to defaults.",
    });
  };

  const toggleRule = (key: keyof ApprovalRules) => {
    setRules({
      ...rules,
      [key]: !(rules[key] as boolean),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Admin Approval Rules</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure leave approval behavior and settings
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleResetRules}
          >
            Reset to Defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Approval System Status */}
          <Alert className={rules.approvalEnabled ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Leave approval system is currently{" "}
              <strong>{rules.approvalEnabled ? "ENABLED" : "DISABLED"}</strong>
            </AlertDescription>
          </Alert>

          {/* Main Approval Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Approval System</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="approvalEnabled"
                  checked={rules.approvalEnabled}
                  onChange={() => toggleRule("approvalEnabled")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="approvalEnabled" className="cursor-pointer font-medium">
                    Enable Leave Approval System
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If disabled, all leave requests will be auto-approved
                  </p>
                </div>
                <Badge variant={rules.approvalEnabled ? "default" : "secondary"}>
                  {rules.approvalEnabled ? "On" : "Off"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="showApprovalConfirmation"
                  checked={rules.showApprovalConfirmation}
                  onChange={() => toggleRule("showApprovalConfirmation")}
                  className="rounded border-gray-300"
                  disabled={!rules.approvalEnabled}
                />
                <div className="flex-1">
                  <Label htmlFor="showApprovalConfirmation" className="cursor-pointer font-medium">
                    Show Confirmation Dialog Before Approval
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Admins must confirm before approving/rejecting leaves
                  </p>
                </div>
                <Badge variant={rules.showApprovalConfirmation ? "default" : "secondary"}>
                  {rules.showApprovalConfirmation ? "On" : "Off"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="allowAdminOverride"
                  checked={rules.allowAdminOverride}
                  onChange={() => toggleRule("allowAdminOverride")}
                  className="rounded border-gray-300"
                  disabled={!rules.approvalEnabled}
                />
                <div className="flex-1">
                  <Label htmlFor="allowAdminOverride" className="cursor-pointer font-medium">
                    Allow Admin to Override Any Leave
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Admins can approve/reject leaves even if they violate policy
                  </p>
                </div>
                <Badge variant={rules.allowAdminOverride ? "default" : "secondary"}>
                  {rules.allowAdminOverride ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Auto-Approval Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Auto-Approval Settings</h3>

            <div>
              <Label>Default Approval Status</Label>
              <Select
                value={rules.defaultApprovalStatus}
                onValueChange={(value: any) =>
                  setRules({ ...rules, defaultApprovalStatus: value })
                }
              >
                <SelectTrigger disabled={!rules.approvalEnabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending (Manual Approval Required)</SelectItem>
                  <SelectItem value="auto_approved">Auto-Approved</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Default status for new leave requests
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
              <input
                type="checkbox"
                id="autoApproveMedical"
                checked={rules.autoApproveMedical}
                onChange={() => toggleRule("autoApproveMedical")}
                className="rounded border-gray-300"
                disabled={!rules.approvalEnabled}
              />
              <div className="flex-1">
                <Label htmlFor="autoApproveMedical" className="cursor-pointer font-medium">
                  Auto-Approve Medical Leaves
                </Label>
                <p className="text-xs text-muted-foreground">
                  Medical leave requests are automatically approved
                </p>
              </div>
              <Badge variant={rules.autoApproveMedical ? "default" : "secondary"}>
                {rules.autoApproveMedical ? "On" : "Off"}
              </Badge>
            </div>
          </div>

          {/* Proof and Documentation Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Proof & Documentation</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="autoRejectMissingProof"
                  checked={rules.autoRejectMissingProof}
                  onChange={() => toggleRule("autoRejectMissingProof")}
                  className="rounded border-gray-300"
                  disabled={!rules.approvalEnabled}
                />
                <div className="flex-1">
                  <Label htmlFor="autoRejectMissingProof" className="cursor-pointer font-medium">
                    Auto-Reject Leave if Required Proof is Missing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Leaves without required medical documents are rejected automatically
                  </p>
                </div>
                <Badge variant={rules.autoRejectMissingProof ? "default" : "secondary"}>
                  {rules.autoRejectMissingProof ? "On" : "Off"}
                </Badge>
              </div>

              {rules.autoRejectMissingProof && (
                <div>
                  <Label>Proof Submission Deadline (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={rules.proofSubmissionDeadline}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        proofSubmissionDeadline: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!rules.approvalEnabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Days within which employee must submit proof after taking leave
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Rejection Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Rejection Settings</h3>

            <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
              <input
                type="checkbox"
                id="rejectionReasonRequired"
                checked={rules.rejectionReasonRequired}
                onChange={() => toggleRule("rejectionReasonRequired")}
                className="rounded border-gray-300"
                disabled={!rules.approvalEnabled}
              />
              <div className="flex-1">
                <Label htmlFor="rejectionReasonRequired" className="cursor-pointer font-medium">
                  Make Rejection Reason Mandatory
                </Label>
                <p className="text-xs text-muted-foreground">
                  Admins must provide a reason when rejecting leaves
                </p>
              </div>
              <Badge variant={rules.rejectionReasonRequired ? "default" : "secondary"}>
                {rules.rejectionReasonRequired ? "Required" : "Optional"}
              </Badge>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Notifications</h3>

            <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
              <input
                type="checkbox"
                id="employeeNotificationsEnabled"
                checked={rules.employeeNotificationsEnabled}
                onChange={() => toggleRule("employeeNotificationsEnabled")}
                className="rounded border-gray-300"
              />
              <div className="flex-1">
                <Label htmlFor="employeeNotificationsEnabled" className="cursor-pointer font-medium">
                  Enable Employee Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send notifications when leaves are approved, rejected, or pending
                </p>
              </div>
              <Badge variant={rules.employeeNotificationsEnabled ? "default" : "secondary"}>
                {rules.employeeNotificationsEnabled ? "On" : "Off"}
              </Badge>
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Note: Admin is the only approval authority in this system. Manager approvals are not used.
              All leave approvals must go through admin.
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <Button
            onClick={handleSaveRules}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Approval Rules
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
