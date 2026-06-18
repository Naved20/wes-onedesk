import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaveBalance {
  casual_leaves_used: number;
  medical_leaves_used: number;
  emergency_leaves_used: number;
  lop_leaves_used: number;
  half_day_leaves_used: number;
}

interface LeaveBalanceCardProps {
  balance: LeaveBalance | null;
  loading?: boolean;
}

const BALANCE_LIMIT = 6;

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

const LEAVE_GROUPS: LeaveGroupConfig[] = [
  {
    code: "PL",
    label: "Paid Leave",
    totalBalance: 12,
    types: [
      { key: "casual_leaves_used", label: "Casual Leave", limit: BALANCE_LIMIT },
      { key: "medical_leaves_used", label: "Medical Leave", limit: BALANCE_LIMIT },
    ],
    color: "text-green-600",
    bgColor: "bg-green-500",
  },
  {
    code: "LE",
    label: "Leave",
    totalBalance: 12,
    types: [
      { key: "emergency_leaves_used", label: "Emergency Leave", limit: BALANCE_LIMIT },
      { key: "lop_leaves_used", label: "LOP", limit: BALANCE_LIMIT },
    ],
    color: "text-amber-600",
    bgColor: "bg-amber-500",
  },
  {
    code: "HD",
    label: "Half Day",
    totalBalance: 6,
    types: [
      { key: "half_day_leaves_used", label: "Half-Day Leave", limit: BALANCE_LIMIT },
    ],
    color: "text-blue-600",
    bgColor: "bg-blue-500",
  },
];

export function LeaveBalanceCard({ balance, loading }: LeaveBalanceCardProps) {
  if (loading) {
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
    return Number(balance?.[key]) || 0;
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
          {LEAVE_GROUPS.map((group) => {
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
