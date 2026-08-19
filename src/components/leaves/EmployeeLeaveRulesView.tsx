import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchLeaveRules, type LeaveRule } from "@/lib/leave-validation-utils";

interface LeaveRuleDisplay {
  leaveType: string;
  label: string;
  color: string;
  rule: LeaveRule;
}

const LEAVE_TYPE_INFO: Record<string, { label: string; color: string; description: string }> = {
  casual: { label: "Casual Leave", color: "border-green-200 bg-green-50/60 text-green-900", description: "Personal reasons" },
  medical: { label: "Medical Leave", color: "border-blue-200 bg-blue-50/60 text-blue-900", description: "Medical proof needed" },
  emergency: { label: "Emergency", color: "border-red-200 bg-red-50/60 text-red-900", description: "Proof required" },
  lop: { label: "LOP", color: "border-gray-200 bg-gray-50/60 text-gray-900", description: "Unpaid leave" },
  half_day: { label: "Half Day", color: "border-amber-200 bg-amber-50/60 text-amber-900", description: "Half-day absence" },
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
        setError("Leave rules not configured");
        setRules([]);
        return;
      }

      const displayRules: LeaveRuleDisplay[] = dbRules
        .map((rule) => {
          const info = LEAVE_TYPE_INFO[rule.leave_type];
          return {
            leaveType: rule.leave_type,
            label: info?.label || rule.leave_type,
            color: info?.color || "border-gray-200 bg-gray-50/60 text-gray-900",
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
      <div className="flex justify-center items-center py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading rules...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="py-2 text-xs">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
      {rules.map((item) => (
        <div
          key={item.leaveType}
          className={`border rounded-lg p-2.5 text-xs space-y-1.5 shadow-sm ${item.color}`}
        >
          <div className="flex items-center justify-between font-semibold border-b border-black/10 pb-1">
            <span className="truncate">{item.label}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/80 font-bold ml-1">
              Max {item.rule.max_per_request}d
            </Badge>
          </div>

          <div className="text-[11px] space-y-1 opacity-90">
            <div className="flex justify-between">
              <span>Single Request:</span>
              <span className="font-semibold">{item.rule.max_per_request} days</span>
            </div>
            <div className="flex justify-between">
              <span>Weekly Limit:</span>
              <span className="font-semibold">{item.rule.max_per_week} days</span>
            </div>
            <div className="flex justify-between">
              <span>Yearly Limit:</span>
              <span className="font-semibold">{item.rule.max_per_month} days</span>
            </div>

            {/* Minimum days in advance required */}
            <div className="flex justify-between border-t border-black/5 pt-1">
              <span>Advance Notice Req.:</span>
              <span className="font-semibold">{item.rule.advance_notice_days || 0} days</span>
            </div>

            {/* Days required between requests */}
            <div className="flex justify-between">
              <span>Gap Between Requests:</span>
              <span className="font-semibold">{item.rule.min_gap_between_requests || 0} days</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
