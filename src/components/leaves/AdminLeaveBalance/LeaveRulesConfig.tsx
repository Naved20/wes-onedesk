import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeaveRules } from "@/lib/leave-validation-utils";

interface LeaveTypeRules {
  maxPerRequest: number;
  maxPerWeek: number;
  maxPerMonth: number;
  minimumGapBetweenRequests: number;
  advanceNoticeDays: number;
}

interface LeaveRules {
  casual: LeaveTypeRules;
  medical: LeaveTypeRules;
  emergency: LeaveTypeRules;
  lop: LeaveTypeRules;
  halfDay: LeaveTypeRules;
}

const DEFAULT_RULES: LeaveRules = {
  casual: {
    maxPerRequest: 2,
    maxPerWeek: 5,
    maxPerMonth: 6,
    minimumGapBetweenRequests: 0,
    advanceNoticeDays: 0,
  },
  medical: {
    maxPerRequest: 2,
    maxPerWeek: 5,
    maxPerMonth: 6,
    minimumGapBetweenRequests: 0,
    advanceNoticeDays: 0,
  },
  emergency: {
    maxPerRequest: 1,
    maxPerWeek: 2,
    maxPerMonth: 3,
    minimumGapBetweenRequests: 7,
    advanceNoticeDays: 0,
  },
  lop: {
    maxPerRequest: 1,
    maxPerWeek: 2,
    maxPerMonth: 6,
    minimumGapBetweenRequests: 0,
    advanceNoticeDays: 0,
  },
  halfDay: {
    maxPerRequest: 1,
    maxPerWeek: 3,
    maxPerMonth: 8,
    minimumGapBetweenRequests: 0,
    advanceNoticeDays: 0,
  },
};

const LEAVE_TYPES = [
  { key: "casual", label: "Casual Leave", color: "bg-blue-50" },
  { key: "medical", label: "Medical Leave", color: "bg-red-50" },
  { key: "emergency", label: "Emergency Leave", color: "bg-yellow-50" },
  { key: "lop", label: "Leave Without Pay (LOP)", color: "bg-gray-50" },
  { key: "halfDay", label: "Half-Day Leave", color: "bg-green-50" },
];

export function LeaveRulesConfig() {
  const [rules, setRules] = useState<LeaveRules>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRulesFromDatabase();
  }, []);

  const loadRulesFromDatabase = async () => {
    setLoading(true);
    try {
      const dbRules = await fetchLeaveRules();

      if (dbRules && dbRules.length > 0) {
        const convertedRules: LeaveRules = { ...DEFAULT_RULES };

        for (const rule of dbRules) {
          // Convert snake_case to camelCase
          let key: keyof LeaveRules;
          if (rule.leave_type === "half_day") {
            key = "halfDay";
          } else {
            key = rule.leave_type as keyof LeaveRules;
          }

          if (key in convertedRules) {
            convertedRules[key] = {
              maxPerRequest: rule.max_per_request,
              maxPerWeek: rule.max_per_week,
              maxPerMonth: rule.max_per_month,
              minimumGapBetweenRequests: rule.min_gap_between_requests,
              advanceNoticeDays: rule.advance_notice_days || 0,
            };
          }
        }

        setRules(convertedRules);
      }
    } catch (error) {
      console.error("Error loading rules:", error);
      toast({
        title: "Error",
        description: "Failed to load leave rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      for (const [leaveType, typeRules] of Object.entries(rules)) {
        // Convert camelCase to snake_case for database
        const dbLeaveType = leaveType === "halfDay" ? "half_day" : leaveType;

        const { error } = await supabase
          .from("leave_rules_config")
          .update({
            max_per_request: typeRules.maxPerRequest,
            max_per_week: typeRules.maxPerWeek,
            max_per_month: typeRules.maxPerMonth,
            min_gap_between_requests: typeRules.minimumGapBetweenRequests,
            advance_notice_days: typeRules.advanceNoticeDays,
          })
          .eq("leave_type", dbLeaveType);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Leave rules updated successfully.",
      });

      await loadRulesFromDatabase();
    } catch (error) {
      console.error("Error saving rules:", error);
      toast({
        title: "Error",
        description: "Failed to save rules. Please try again.",
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
      description: "Rules reset to defaults (not saved yet). Click Save to apply.",
    });
  };

  const updateLeaveTypeRule = (
    leaveType: keyof LeaveRules,
    field: keyof LeaveTypeRules,
    value: number
  ) => {
    setRules({
      ...rules,
      [leaveType]: {
        ...rules[leaveType],
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leave Rules Configuration</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set rules for each leave type
            </p>
          </div>
          <Button variant="outline" onClick={handleResetRules}>
            Reset to Defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading rules...</span>
            </div>
          ) : (
            <>
              {LEAVE_TYPES.map(({ key, label, color }) => {
                const leaveTypeKey = key as keyof LeaveRules;
                const typeRules = rules[leaveTypeKey];

                return (
                  <div
                    key={key}
                    className={`border rounded-lg p-4 space-y-4 ${color}`}
                  >
                    <h3 className="font-semibold text-lg">{label}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <Label>Max Per Request (days)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={typeRules.maxPerRequest}
                          onChange={(e) =>
                            updateLeaveTypeRule(
                              leaveTypeKey,
                              "maxPerRequest",
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum days in a single leave request
                        </p>
                      </div>

                      <div>
                        <Label>Max Per Week (days)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={typeRules.maxPerWeek}
                          onChange={(e) =>
                            updateLeaveTypeRule(
                              leaveTypeKey,
                              "maxPerWeek",
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum leaves in a week
                        </p>
                      </div>

                      <div>
                        <Label>Max Per Month (days)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={typeRules.maxPerMonth}
                          onChange={(e) =>
                            updateLeaveTypeRule(
                              leaveTypeKey,
                              "maxPerMonth",
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum leaves in a month
                        </p>
                      </div>

                      <div>
                        <Label>Min Gap Between Requests (days)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={typeRules.minimumGapBetweenRequests}
                          onChange={(e) =>
                            updateLeaveTypeRule(
                              leaveTypeKey,
                              "minimumGapBetweenRequests",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Days required between requests (0 = no gap required)
                        </p>
                      </div>


                    <div>
                      <Label>Advance Notice Required (days)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={typeRules.advanceNoticeDays}
                        onChange={(e) =>
                          updateLeaveTypeRule(
                            leaveTypeKey,
                            "advanceNoticeDays",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Minimum days in advance required to apply for this leave (0 = no advance notice)
                      </p>
                    </div>

                    </div>




                  </div>
                );
              })}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  These rules will apply to all new leave requests. Existing
                  leaves won't be affected.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSaveRules}
                disabled={saving || loading}
                className="w-full gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Leave Rules
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
