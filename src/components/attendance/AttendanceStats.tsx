import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  CalendarDays, 
  TrendingUp,
  AlertCircle,
  Coffee
} from "lucide-react";

interface AttendanceStatsProps {
  userId: string;
  year: number;
  month: number;
}

interface Stats {
  working_days: number;
  present_days: number;
  half_days: number;
  late_days: number;
  pending_days: number;
  rejected_days: number;
  casual_leaves: number;
  sick_leaves: number;
  unplanned_leaves: number;
  absent_days: number;
  effective_present: number;
  attendance_percentage: number;
  present_on_time: number;
}

export function AttendanceStats({ userId, year, month }: AttendanceStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId, year, month]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('calculate_attendance_stats', {
        p_user_id: userId,
        p_year: year,
        p_month: month,
      });

      if (error) throw error;
      setStats(data as unknown as Stats);
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600 dark:text-green-400";
    if (percentage >= 75) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-green-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4">
      {/* Main Attendance Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attendance Percentage</p>
                <p className={`text-3xl font-bold ${getPercentageColor(stats.attendance_percentage)}`}>
                  {stats.attendance_percentage}%
                </p>
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Progress 
                value={stats.attendance_percentage} 
                className="h-3"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {stats.effective_present} / {stats.working_days} effective days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Working Days</span>
            </div>
            <p className="text-2xl font-bold">{stats.working_days}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">PR + LT</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.present_days}
              {stats.half_days > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  (+{stats.half_days} half)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PR: {stats.present_on_time || (stats.present_days - stats.late_days)} | LT: {stats.late_days}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Casual Leaves</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.casual_leaves}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Sick Leaves</span>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.sick_leaves}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Late Check-ins</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.late_days}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Absent</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.absent_days}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending/Rejected Info */}
      {(stats.pending_days > 0 || stats.rejected_days > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.pending_days > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm">
              <Clock className="h-3.5 w-3.5" />
              {stats.pending_days} pending approval
            </div>
          )}
          {stats.rejected_days > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
              <XCircle className="h-3.5 w-3.5" />
              {stats.rejected_days} rejected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
