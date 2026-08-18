import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info, AlertCircle } from "lucide-react";
import { fetchLeaveRules, type LeaveRule } from "@/lib/leave-validation-utils";

interface LeaveRuleDisplay {
  leaveType: string;
  label: string;
  color: string;
  rule: LeaveRule;
}

const LEAVE_TYPE_INFO: Record<string, { label: string; color: string; description: string }> = {
  casual: {
    label: "Casual Leave",
    color: "bg-blue-50 border-blue-200",
    description: "General leave for personal reasons",
  },
  medical: {
    label: "Medical Leave",
    color: "bg-red-50 border-red-200",
    description: "Leave for medical reasons with medical certificate required",
  },
  emergency: {
    label: "Emergency Leave",
    color: "bg-yellow-50 border-yellow-200",
    description: "For unforeseen emergency situations with proof submission",
  },
  lop: {
    label: "Leave Without Pay (LOP)",
    color: "bg-gray-50 border-gray-200",
    description: "Unpaid leave that impacts salary",
  },
  half_day: {
    label: "Half-Day Leave",
    color: "bg-green-50 border-green-200",
    description: "Half-day absence (morning or afternoon)",
  },
};

export function EmployeeLeaveRulesView() {
  const [rules, setRules] = useState<LeaveRuleDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const dbRules = await fetchLeaveRules();

      if (!dbRules || dbRules.length === 0) {
        setError("Leave rules not configured by admin");
        setRules([]);
        return;
      }

      const displayRules: LeaveRuleDisplay[] = dbRules
        .map((rule) => {
          const info = LEAVE_TYPE_INFO[rule.leave_type];
          return {
            leaveType: rule.leave_type,
            label: info?.label || rule.leave_type,
            color: info?.color || "bg-gray-50 border-gray-200",
            rule,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      setRules(displayRules);
    } catch (err) {
      console.error("Error loading rules:", err);
      setError("Failed to load leave rules");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading leave rules...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leave Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Leave Request Rules</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Please review these rules before submitting a leave request
          </p>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              These rules define the limits and requirements for each leave type. Requests violating these rules will be rejected automatically.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Rules Grid */}
      <div className="space-y-4">
        {rules.map((item) => (
          <Card key={item.leaveType} className={`border-l-4 ${item.color}`}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {LEAVE_TYPE_INFO[item.leaveType]?.description}
                    </p>
                  </div>
                </div>

                {/* Rules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Max Per Request */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Max Per Request
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{item.rule.max_per_request}</span>
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Maximum days you can request in a single application
                    </p>
                  </div>

                  {/* Max Per Week */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Max Per Week
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{item.rule.max_per_week}</span>
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Maximum days allowed in any 7-day period
                    </p>
                  </div>

                  {/* Max Per Year */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Max Per Year
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{item.rule.max_per_month}</span>
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Maximum days allowed in a calendar year
                    </p>
                  </div>

                  {/* Min Gap Between Requests */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Min Gap Between Requests
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {item.rule.min_gap_between_requests}
                      </span>
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.rule.min_gap_between_requests === 0
                        ? "No minimum gap required between requests"
                        : `Minimum days required between consecutive requests`}
                    </p>
                  </div>
                </div>

                {/* Rules Summary */}
                <div className="border-t pt-3 text-sm text-muted-foreground space-y-1">
                  <p>
                    ✓ You can submit leave requests {item.rule.max_per_request} days at a time
                  </p>
                  <p>
                    ✓ Maximum {item.rule.max_per_week} days per week
                  </p>
                  <p>
                    ✓ Maximum {item.rule.max_per_month} days per year
                  </p>
                  {item.rule.min_gap_between_requests > 0 && (
                    <p>
                      ✓ {item.rule.min_gap_between_requests} day gap required between requests
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            Tips for Submitting Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-blue-900">
          <p>• Plan your leaves in advance to respect request limits</p>
          <p>• Keep track of leaves used in the current week and year</p>
          <p>• If you need more leave, consider different leave types</p>
          <p>• Submit requests early to comply with advance notice requirements</p>
          <p>• Always provide clear reasons for your leave requests</p>
        </CardContent>
      </Card>
    </div>
  );
}
