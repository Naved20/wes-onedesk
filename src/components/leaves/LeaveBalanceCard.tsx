import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LeaveBalance {
  casual_leaves_used: number;
  medical_leaves_used: number;
  emergency_leaves_used: number;
  lop_leaves_used: number;
  half_day_leaves_used: number;
  casual_leaves_entitled?: number;
  medical_leaves_entitled?: number;
  emergency_leaves_entitled?: number;
  lop_leaves_entitled?: number;
  half_day_leaves_entitled?: number;
}

interface LeaveUsageKey {
  used: keyof LeaveBalance;
  entitled: keyof LeaveBalance;
}

interface LeaveRule {
  leave_type: string;
  max_per_request: number;
  max_per_week: number;
  max_per_month: number;
  min_gap_between_requests: number;
  advance_notice_days: number;
}

interface LeaveBalanceCardProps {
  balance: LeaveBalance | null;
  loading?: boolean;
}

interface LeavePolicyConfig {
  leave_type: string;
  monthly_balance: number;
  code: string;
}

interface LeaveGroupConfig {
  code: string;
  label: string;
  totalBalance: number;
  types: {
    used: keyof LeaveBalance;
    entitled: keyof LeaveBalance;
    label: string;
  }[];
  color: string;
  bgColor: string;
}

const DEFAULT_LEAVE_GROUPS: LeaveGroupConfig[] = [
  {
    code: "PL",
    label: "Paid Leave",
    totalBalance: 12,
    types: [
      { used: "casual_leaves_used", entitled: "casual_leaves_entitled", label: "Casual Leave" },
      { used: "medical_leaves_used", entitled: "medical_leaves_entitled", label: "Medical Leave" },
    ],
    color: "text-green-600",
    bgColor: "bg-green-500",
  },
  {
    code: "LE",
    label: "Leave",
    totalBalance: 12,
    types: [
      { used: "emergency_leaves_used", entitled: "emergency_leaves_entitled", label: "Emergency Leave" },
      { used: "lop_leaves_used", entitled: "lop_leaves_entitled", label: "LOP" },
    ],
    color: "text-amber-600",
    bgColor: "bg-amber-500",
  },
  {
    code: "HD",
    label: "Half Day",
    totalBalance: 6,
    types: [
      { used: "half_day_leaves_used", entitled: "half_day_leaves_entitled", label: "Half-Day Leave" },
    ],
    color: "text-blue-600",
    bgColor: "bg-blue-500",
  },
];

export function LeaveBalanceCard({ balance, loading: parentLoading }: LeaveBalanceCardProps) {
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupConfig[]>(DEFAULT_LEAVE_GROUPS);
  const [actualBalance, setActualBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveRules, setLeaveRules] = useState<Record<string, LeaveRule>>({});
  const [rulesLoading, setRulesLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEmployeeActualBalance();
      fetchLeaveRules();
    }
  }, [user, balance]); // Re-fetch when parent balance updates

  const fetchLeaveRules = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_rules_config")
        .select("*");

      if (error) throw error;

      const rulesMap: Record<string, LeaveRule> = {};
      if (data) {
        for (const rule of data) {
          rulesMap[rule.leave_type] = rule;
        }
      }
      setLeaveRules(rulesMap);
    } catch (error) {
      console.error("Error fetching leave rules:", error);
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchEmployeeActualBalance = async () => {
    if (!user) return;
    
    try {
      const now = new Date();
      const year = now.getFullYear();

      // Get employee's actual balance from leave_balances table
      let { data: employeeBalance, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .maybeSingle();

      if (error) throw error;

      // If no record exists, create default balance record with default entitled values
      if (!employeeBalance) {
        const { data: newBalance, error: insertError } = await supabase
          .from("leave_balances")
          .insert({
            user_id: user.id,
            month: 1, // Default month
            year,
            casual_leaves_used: 0,
            medical_leaves_used: 0,
            emergency_leaves_used: 0,
            lop_leaves_used: 0,
            half_day_leaves_used: 0,
            casual_leaves_entitled: 6,
            medical_leaves_entitled: 6,
            emergency_leaves_entitled: 6,
            lop_leaves_entitled: 6,
            half_day_leaves_entitled: 6,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        employeeBalance = newBalance;
      }

      // Use parent balance if available (more recent), otherwise use fetched data
      const finalBalance = balance || employeeBalance;

      // Set actual balance from employee data
      setActualBalance({
        casual_leaves_used: Number(finalBalance.casual_leaves_used) || 0,
        medical_leaves_used: Number((finalBalance as any).medical_leaves_used) || 0,
        emergency_leaves_used: Number((finalBalance as any).emergency_leaves_used) || 0,
        lop_leaves_used: Number((finalBalance as any).lop_leaves_used) || 0,
        half_day_leaves_used: Number((finalBalance as any).half_day_leaves_used) || 0,
        casual_leaves_entitled: Number((finalBalance as any).casual_leaves_entitled) || 6,
        medical_leaves_entitled: Number((finalBalance as any).medical_leaves_entitled) || 6,
        emergency_leaves_entitled: Number((finalBalance as any).emergency_leaves_entitled) || 6,
        lop_leaves_entitled: Number((finalBalance as any).lop_leaves_entitled) || 6,
        half_day_leaves_entitled: Number((finalBalance as any).half_day_leaves_entitled) || 6,
      });

      // Get entitled amounts from employee balance
      const casualEntitled = Number((finalBalance as any)?.casual_leaves_entitled) || 6;
      const medicalEntitled = Number((finalBalance as any)?.medical_leaves_entitled) || 6;
      const emergencyEntitled = Number((finalBalance as any)?.emergency_leaves_entitled) || 6;
      const lopEntitled = Number((finalBalance as any)?.lop_leaves_entitled) || 6;
      const halfDayEntitled = Number((finalBalance as any)?.half_day_leaves_entitled) || 6;

      // Build dynamic groups with actual employee balance
      const dynamicGroups: LeaveGroupConfig[] = [];

      // PL (Paid Leave) - Casual + Medical
      const plBalance = casualEntitled + medicalEntitled;
      dynamicGroups.push({
        code: "PL",
        label: "Paid Leave",
        totalBalance: plBalance,
        types: [
          { used: "casual_leaves_used", entitled: "casual_leaves_entitled", label: "Casual Leave" },
          { used: "medical_leaves_used", entitled: "medical_leaves_entitled", label: "Medical Leave" },
        ],
        color: "text-green-600",
        bgColor: "bg-green-500",
      });

      // LE (Leave) - Emergency + LOP
      const leBalance = emergencyEntitled + lopEntitled;
      dynamicGroups.push({
        code: "LE",
        label: "Leave",
        totalBalance: leBalance,
        types: [
          { used: "emergency_leaves_used", entitled: "emergency_leaves_entitled", label: "Emergency Leave" },
          { used: "lop_leaves_used", entitled: "lop_leaves_entitled", label: "LOP" },
        ],
        color: "text-amber-600",
        bgColor: "bg-amber-500",
      });

      // HD (Half Day)
      dynamicGroups.push({
        code: "HD",
        label: "Half Day",
        totalBalance: halfDayEntitled,
        types: [
          { used: "half_day_leaves_used", entitled: "half_day_leaves_entitled", label: "Half-Day Leave" },
        ],
        color: "text-blue-600",
        bgColor: "bg-blue-500",
      });

      setLeaveGroups(dynamicGroups);

    } catch (error) {
      console.error("Error fetching employee balance:", error);
      setLeaveGroups(DEFAULT_LEAVE_GROUPS);
    } finally {
      setLoading(false);
    }
  };

  if (parentLoading || loading) {
    return (
      <Card className="md:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Leave Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-2 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUsed = (key: keyof LeaveBalance) => {
    return Number(actualBalance?.[key]) || 0;  // ✅ Use actualBalance from leave_balances table
  };

  return (
    <Card className="md:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Leave Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Leave Groups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaveGroups.map((group) => {
            const totalUsed = group.types.reduce(
              (sum, t) => sum + getUsed(t.used),
              0
            );
            const totalEntitled = group.types.reduce(
              (sum, t) => sum + (Number(actualBalance?.[t.entitled]) || 0),
              0
            );
            const totalRemaining = Math.max(0, totalEntitled - totalUsed);
            const usagePercent = totalEntitled > 0 ? (totalUsed / totalEntitled) * 100 : 0;

            return (
              <div
                key={group.code}
                className="border rounded-lg p-3 space-y-3"
              >
                {/* Group Header */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-xs">
                      {group.code}
                    </Badge>
                    <span className="text-sm font-medium">{group.label}</span>
                  </div>
                  <Badge
                    variant={totalRemaining > 0 ? "secondary" : "destructive"}
                  >
                    {totalRemaining}/{totalEntitled}
                  </Badge>
                </div>

                {/* Progress */}
                <Progress value={usagePercent} className="h-2" />

                {/* Remaining */}
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-semibold ${group.color}`}>
                    {totalRemaining} remaining
                  </span>
                  {totalRemaining === 0 && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limit reached
                    </span>
                  )}
                </div>

                {/* Individual Type Breakdown */}
                <div className="space-y-1 pt-1 border-t">
                  {group.types.map((t) => {
                    const used = getUsed(t.used);
                    const limit = Number(actualBalance?.[t.entitled]) || 0;
                    const remaining = Math.max(0, limit - used);
                    return (
                      <div
                        key={t.used}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-muted-foreground">
                          {t.label}
                        </span>
                        <span
                          className={
                            remaining === 0
                              ? "text-destructive font-medium"
                              : "text-foreground"
                          }
                        >
                          {remaining}/{limit} remaining
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Leave Rules Summary */}
        {!rulesLoading && Object.keys(leaveRules).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">Leave Rules</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
              {/* Casual */}
              {leaveRules.casual && (
                <div className="border border-blue-200 rounded p-2 bg-white">
                  <p className="font-semibold text-blue-900 mb-1">Casual</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>Maximum days in a single leave request: {leaveRules.casual.max_per_request} day</p>
                    <p>Maximum leaves in a week {leaveRules.casual.max_per_week} day</p>
                    <p>Maximum leaves in a year {leaveRules.casual.max_per_month} day</p>
                    <p>Days required between requests {leaveRules.casual.min_gap_between_requests} day</p>
                    <p className="text-orange-600">Minimum days in advance required to apply for leave {leaveRules.casual.advance_notice_days} day</p>
                  </div>
                </div>
              )}

              {/* Medical */}
              {leaveRules.medical && (
                <div className="border border-blue-200 rounded p-2 bg-white">
                  <p className="font-semibold text-blue-900 mb-1">Medical</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>Maximum days in a single leave request: {leaveRules.medical.max_per_request} day</p>
                    <p>Maximum leaves in a week {leaveRules.medical.max_per_week} day</p>
                    <p>Maximum leaves in a year {leaveRules.medical.max_per_month} day</p>
                    <p>Days required between requests {leaveRules.medical.min_gap_between_requests} day</p>
                    <p className="text-orange-600">Minimum days in advance required to apply for leave {leaveRules.medical.advance_notice_days} day</p>
                  </div>
                </div>
              )}

              {/* Emergency */}
              {leaveRules.emergency && (
                <div className="border border-blue-200 rounded p-2 bg-white">
                  <p className="font-semibold text-blue-900 mb-1">Emergency</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>Maximum days in a single leave request: {leaveRules.emergency.max_per_request} day</p>
                    <p>Maximum leaves in a week {leaveRules.emergency.max_per_week} day</p>
                    <p>Maximum leaves in a year {leaveRules.emergency.max_per_month} day</p>
                    <p>Days required between requests {leaveRules.emergency.min_gap_between_requests} day</p>
                    <p className="text-orange-600">Minimum days in advance required to apply for leave {leaveRules.emergency.advance_notice_days} day</p>
                  </div>
                </div>
              )}

              {/* LOP */}
              {leaveRules.lop && (
                <div className="border border-blue-200 rounded p-2 bg-white">
                  <p className="font-semibold text-blue-900 mb-1">LOP</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>Maximum days in a single leave request: {leaveRules.lop.max_per_request} day</p>
                    <p>Maximum leaves in a week {leaveRules.lop.max_per_week} day</p>
                    <p>Maximum leaves in a year {leaveRules.lop.max_per_month} day</p>
                    <p>Days required between requests {leaveRules.lop.min_gap_between_requests} day</p>
                    <p className="text-orange-600">Minimum days in advance required to apply for leave {leaveRules.lop.advance_notice_days} day</p>
                  </div>
                </div>
              )}

              {/* Half Day */}
              {leaveRules.half_day && (
                <div className="border border-blue-200 rounded p-2 bg-white">
                  <p className="font-semibold text-blue-900 mb-1">Half Day</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>Maximum days in a single leave request: {leaveRules.half_day.max_per_request} day</p>
                    <p>Maximum leaves in a week {leaveRules.half_day.max_per_week} day</p>
                    <p>Maximum leaves in a year {leaveRules.half_day.max_per_month} day</p>
                    <p>Days required between requests {leaveRules.half_day.min_gap_between_requests} day</p>
                    <p className="text-orange-600">Minimum days in advance required to apply for leave {leaveRules.half_day.advance_notice_days} day</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Policy Legend */}
        <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>PL (Paid Leave):</strong> Casual + Medical — No deduction
            </p>
            <p>
              <strong>LE (Leave):</strong> Emergency + LOP — Salary deduction applied
            </p>
            <p>
              <strong>HD (Half Day):</strong> Half day leave — 0.5 day deduction
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
