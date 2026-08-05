import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    key: keyof LeaveBalance;
    label: string;
    limit: number;
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
      { key: "casual_leaves_used", label: "Casual Leave", limit: 6 },
      { key: "medical_leaves_used", label: "Medical Leave", limit: 6 },
    ],
    color: "text-green-600",
    bgColor: "bg-green-500",
  },
  {
    code: "LE",
    label: "Leave",
    totalBalance: 12,
    types: [
      { key: "emergency_leaves_used", label: "Emergency Leave", limit: 6 },
      { key: "lop_leaves_used", label: "LOP", limit: 6 },
    ],
    color: "text-amber-600",
    bgColor: "bg-amber-500",
  },
  {
    code: "HD",
    label: "Half Day",
    totalBalance: 6,
    types: [
      { key: "half_day_leaves_used", label: "Half-Day Leave", limit: 6 },
    ],
    color: "text-blue-600",
    bgColor: "bg-blue-500",
  },
];

export function LeaveBalanceCard({ balance, loading: parentLoading }: LeaveBalanceCardProps) {
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupConfig[]>(DEFAULT_LEAVE_GROUPS);
  const [actualBalance, setActualBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchEmployeeActualBalance();
    }
  }, [user]);

  const fetchEmployeeActualBalance = async () => {
    if (!user) return;
    
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Get employee's actual balance from leave_balances table
      const { data: employeeBalance, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (error) throw error;

      // If no record exists, create default balance record
      if (!employeeBalance) {
        const { data: newBalance, error: insertError } = await supabase
          .from("leave_balances")
          .insert({
            user_id: user.id,
            month,
            year,
            casual_leaves_used: 0,
            medical_leaves_used: 0,
            emergency_leaves_used: 0,
            lop_leaves_used: 0,
            half_day_leaves_used: 0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        // Set actual balance to the newly created record
        setActualBalance({
          casual_leaves_used: 0,
          medical_leaves_used: 0,
          emergency_leaves_used: 0,
          lop_leaves_used: 0,
          half_day_leaves_used: 0,
        });
      } else {
      // Set actual balance from fetched employee data
        setActualBalance({
          casual_leaves_used: employeeBalance.casual_leaves_used || 0,
          medical_leaves_used: employeeBalance.medical_leaves_used || 0,
          emergency_leaves_used: employeeBalance.emergency_leaves_used || 0,
          lop_leaves_used: employeeBalance.lop_leaves_used || 0,
          half_day_leaves_used: employeeBalance.half_day_leaves_used || 0,
          casual_leaves_entitled: (employeeBalance as any).casual_leaves_entitled || 6,
          medical_leaves_entitled: (employeeBalance as any).medical_leaves_entitled || 6,
          emergency_leaves_entitled: (employeeBalance as any).emergency_leaves_entitled || 6,
          lop_leaves_entitled: (employeeBalance as any).lop_leaves_entitled || 6,
          half_day_leaves_entitled: (employeeBalance as any).half_day_leaves_entitled || 6,
        });
      }

      // Get policy defaults for entitled amounts (no longer used, using employee balance instead)
      // Kept for reference but not used
      const { data: policies, error: policyError } = await supabase
        .from("leave_balance_config")
        .select("leave_type, monthly_balance, code");

      if (policyError) console.log("Policy fetch note:", policyError);

        // Get actual usage from employee balance
      const casualUsed = Number(employeeBalance?.casual_leaves_used) || 0;
      const medicalUsed = Number(employeeBalance?.medical_leaves_used) || 0;
      const emergencyUsed = Number(employeeBalance?.emergency_leaves_used) || 0;
      const lopUsed = Number(employeeBalance?.lop_leaves_used) || 0;
      const halfDayUsed = Number(employeeBalance?.half_day_leaves_used) || 0;

      // Get entitled amounts from employee balance (NOT from policy)
      const casualEntitled = Number((employeeBalance as any)?.casual_leaves_entitled) || 6;
      const medicalEntitled = Number((employeeBalance as any)?.medical_leaves_entitled) || 6;
      const emergencyEntitled = Number((employeeBalance as any)?.emergency_leaves_entitled) || 6;
      const lopEntitled = Number((employeeBalance as any)?.lop_leaves_entitled) || 6;
      const halfDayEntitled = Number((employeeBalance as any)?.half_day_leaves_entitled) || 6;

      // Build dynamic groups with actual employee balance
      const dynamicGroups: LeaveGroupConfig[] = [];

      // PL (Paid Leave) - Casual + Medical
      const plBalance = casualEntitled + medicalEntitled;
      dynamicGroups.push({
        code: "PL",
        label: "Paid Leave",
        totalBalance: plBalance,
        types: [
          { key: "casual_leaves_used", label: "Casual Leave", limit: casualEntitled },
          { key: "medical_leaves_used", label: "Medical Leave", limit: medicalEntitled },
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
          { key: "emergency_leaves_used", label: "Emergency Leave", limit: emergencyEntitled },
          { key: "lop_leaves_used", label: "LOP", limit: lopEntitled },
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
          { key: "half_day_leaves_used", label: "Half-Day Leave", limit: halfDayEntitled },
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
            Monthly Leave Balance
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
          Monthly Leave Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Leave Groups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaveGroups.map((group) => {
            const totalUsed = group.types.reduce(
              (sum, t) => sum + getUsed(t.key),
              0
            );
            const totalRemaining = Math.max(0, group.totalBalance - totalUsed);
            const usagePercent = (totalUsed / group.totalBalance) * 100;

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
                    {totalUsed}/{group.totalBalance}
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
                    const used = getUsed(t.key);
                    const remaining = Math.max(0, t.limit - used);
                    return (
                      <div
                        key={t.key}
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
                          {used}/{t.limit} used
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Policy Legend */}
        <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>PL (Paid Leave):</strong> Casual (4 days notice, max 2
              days) + Medical (same day, max 2 days) — No deduction
            </p>
            <p>
              <strong>LE (Leave):</strong> Emergency (same day, 1 day, 1 LOP) +
              LOP (next day, 1 day, 1 LOP)
            </p>
            <p>
              <strong>HD (Half Day):</strong> 1 day notice, 0.5 LOP deduction
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
