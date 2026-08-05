import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LeaveRules {
  maxLeavePerMonth: number;
  maxLeavePerRequest: number;
  maxConsecutiveLeave: number;
  minGapCasualLeaves: number;
  minGapMedicalLeaves: number;
  minGapEmergencyLeaves: number;
  countWeekends: boolean;
  countHolidays: boolean;
  countSundays: boolean;
  halfDayAllowed: boolean;
}

const DEFAULT_RULES: LeaveRules = {
  maxLeavePerMonth: 6,
  maxLeavePerRequest: 2,
  maxConsecutiveLeave: 10,
  minGapCasualLeaves: 0,
  minGapMedicalLeaves: 0,
  minGapEmergencyLeaves: 0,
  countWeekends: false,
  countHolidays: false,
  countSundays: false,
  halfDayAllowed: true,
};

export function LeaveRulesConfig() {
  const [rules, setRules] = useState<LeaveRules>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      // In a real app, save to database
      // For now, just show success
      toast({
        title: "Success",
        description: "Leave rules updated successfully.",
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
    setRules(DEFAULT_RULES);
    toast({
      title: "Reset",
      description: "Rules reset to defaults.",
    });
  };

  const toggleBooleanRule = (key: keyof LeaveRules) => {
    setRules({
      ...rules,
      [key]: !(rules[key] as boolean),
    });
  };

  const updateNumericRule = (key: keyof LeaveRules, value: number) => {
    setRules({
      ...rules,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leave Rules Configuration</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set system-wide rules for leave requests
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
          {/* Limit Rules */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Limit Rules</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Max Leave Per Month (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={rules.maxLeavePerMonth}
                  onChange={(e) =>
                    updateNumericRule("maxLeavePerMonth", parseInt(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum total leaves an employee can take in a month
                </p>
              </div>

              <div>
                <Label>Max Leave Per Request (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={rules.maxLeavePerRequest}
                  onChange={(e) =>
                    updateNumericRule("maxLeavePerRequest", parseInt(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum days in a single leave request
                </p>
              </div>

              <div>
                <Label>Max Consecutive Leave (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={rules.maxConsecutiveLeave}
                  onChange={(e) =>
                    updateNumericRule("maxConsecutiveLeave", parseInt(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum continuous leave period allowed
                </p>
              </div>
            </div>
          </div>

          {/* Gap Rules */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Minimum Gap Between Leaves</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Casual Leaves Gap (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={rules.minGapCasualLeaves}
                  onChange={(e) =>
                    updateNumericRule("minGapCasualLeaves", parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Days required between casual leave requests
                </p>
              </div>

              <div>
                <Label>Medical Leaves Gap (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={rules.minGapMedicalLeaves}
                  onChange={(e) =>
                    updateNumericRule("minGapMedicalLeaves", parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Days required between medical leave requests
                </p>
              </div>

              <div>
                <Label>Emergency Leaves Gap (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={rules.minGapEmergencyLeaves}
                  onChange={(e) =>
                    updateNumericRule("minGapEmergencyLeaves", parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Days required between emergency leave requests
                </p>
              </div>
            </div>
          </div>

          {/* Counting Rules */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Day Counting Rules</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="countSundays"
                  checked={rules.countSundays}
                  onChange={() => toggleBooleanRule("countSundays")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="countSundays" className="cursor-pointer font-medium">
                    Count Sundays as Leave Days
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, Sundays will be counted towards leave duration
                  </p>
                </div>
                <Badge variant={rules.countSundays ? "default" : "secondary"}>
                  {rules.countSundays ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="countWeekends"
                  checked={rules.countWeekends}
                  onChange={() => toggleBooleanRule("countWeekends")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="countWeekends" className="cursor-pointer font-medium">
                    Count Weekends as Leave Days
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, Saturdays and Sundays will be counted towards leave duration
                  </p>
                </div>
                <Badge variant={rules.countWeekends ? "default" : "secondary"}>
                  {rules.countWeekends ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="countHolidays"
                  checked={rules.countHolidays}
                  onChange={() => toggleBooleanRule("countHolidays")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="countHolidays" className="cursor-pointer font-medium">
                    Count Holidays as Leave Days
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, public holidays will be counted towards leave duration
                  </p>
                </div>
                <Badge variant={rules.countHolidays ? "default" : "secondary"}>
                  {rules.countHolidays ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Half Day Rules */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Half-Day Leave</h3>

            <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
              <input
                type="checkbox"
                id="halfDayAllowed"
                checked={rules.halfDayAllowed}
                onChange={() => toggleBooleanRule("halfDayAllowed")}
                className="rounded border-gray-300"
              />
              <div className="flex-1">
                <Label htmlFor="halfDayAllowed" className="cursor-pointer font-medium">
                  Allow Half-Day Leaves
                </Label>
                <p className="text-xs text-muted-foreground">
                  If enabled, employees can request half-day leaves
                </p>
              </div>
              <Badge variant={rules.halfDayAllowed ? "default" : "secondary"}>
                {rules.halfDayAllowed ? "Allowed" : "Not Allowed"}
              </Badge>
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              These rules will apply to all new leave requests. Existing leaves won't be affected.
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <Button
            onClick={handleSaveRules}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Leave Rules
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
