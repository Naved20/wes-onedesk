import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  CalendarDays, 
  TrendingUp,
  AlertCircle,
  Coffee
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceStatsProps {
  userId: string;
  year: number;
  month: number;
  attendanceRecords?: Attendance[];
}

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: string;
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

export function AttendanceStats({ userId, year, month, attendanceRecords = [] }: AttendanceStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  useEffect(() => {
    fetchStats();
    fetchLeaves();

    // Auto-refresh when attendance or leaves change for this user
    const channel = supabase
      .channel(`attendance-stats-${userId}-${year}-${month}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${userId}` }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves', filter: `user_id=eq.${userId}` }, () => {
        fetchStats();
        fetchLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, year, month]);

  const fetchLeaves = async () => {
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('start_date', `${year}-${String(month).padStart(2, '0')}-31`)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setLeaves(data || []);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
  };

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
              <span className="text-xs text-muted-foreground">Present</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.present_days}
              {stats.half_days > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  (+{stats.half_days} half)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Casual Leaves - Clickable */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Casual Leaves</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'casual' || l.leave_type === 'emergency').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No casual leaves this month</p>
              ) : (
                leaves
                  .filter(l => l.leave_type === 'casual' || l.leave_type === 'emergency')
                  .map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <div>
                        <p className="font-medium">
                          {format(new Date(leave.start_date), "MMM dd, yyyy")}
                          {leave.start_date !== leave.end_date && ` - ${format(new Date(leave.end_date), "MMM dd, yyyy")}`}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground">{leave.reason}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30">
                        {leave.leave_type === 'emergency' ? 'Emergency' : 'Casual'}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Sick Leaves - Clickable */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sick Leaves</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'sick').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No sick leaves this month</p>
              ) : (
                leaves
                  .filter(l => l.leave_type === 'sick')
                  .map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                      <div>
                        <p className="font-medium">
                          {format(new Date(leave.start_date), "MMM dd, yyyy")}
                          {leave.start_date !== leave.end_date && ` - ${format(new Date(leave.end_date), "MMM dd, yyyy")}`}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground">{leave.reason}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                        Sick
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Late Check-ins - Clickable */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Late Check-ins</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {attendanceRecords
                .filter(r => r.user_id === userId && r.is_late && 
                  new Date(r.date).getMonth() === month - 1 &&
                  new Date(r.date).getFullYear() === year)
                .length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No late check-ins this month</p>
              ) : (
                attendanceRecords
                  .filter(r => r.user_id === userId && r.is_late && 
                    new Date(r.date).getMonth() === month - 1 &&
                    new Date(r.date).getFullYear() === year)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                      <div>
                        <p className="font-medium">{format(new Date(record.date), "MMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.check_in_time 
                            ? `Check-in: ${format(new Date(record.check_in_time), "hh:mm a")}`
                            : "No check-in"}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30">
                        Late
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Absent - Clickable */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Absent Days</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {attendanceRecords
                .filter(r => r.user_id === userId && 
                  (r.calculated_status === 'absent' || r.status === 'rejected') &&
                  new Date(r.date).getMonth() === month - 1 &&
                  new Date(r.date).getFullYear() === year)
                .length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No absent days this month</p>
              ) : (
                attendanceRecords
                  .filter(r => r.user_id === userId && 
                    (r.calculated_status === 'absent' || r.status === 'rejected') &&
                    new Date(r.date).getMonth() === month - 1 &&
                    new Date(r.date).getFullYear() === year)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                      <div>
                        <p className="font-medium">{format(new Date(record.date), "MMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.check_in_time 
                            ? `Check-in: ${format(new Date(record.check_in_time), "hh:mm a")}`
                            : "No check-in"}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {record.status === 'rejected' ? 'Rejected' : 'Absent'}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending/Rejected Info - Clickable to show details */}
      {(stats.pending_days > 0 || stats.rejected_days > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.pending_days > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors">
                  <Clock className="h-3.5 w-3.5" />
                  {stats.pending_days} pending approval
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pending Approvals</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {attendanceRecords
                    .filter(r => r.user_id === userId && r.status === 'pending' && 
                      new Date(r.date).getMonth() === month - 1 &&
                      new Date(r.date).getFullYear() === year)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                        <div>
                          <p className="font-medium">{format(new Date(record.date), "MMM dd, yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.check_in_time 
                              ? `Check-in: ${format(new Date(record.check_in_time), "hh:mm a")}`
                              : "No check-in"}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30">
                          Pending
                        </Badge>
                      </div>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
          {stats.rejected_days > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                  <XCircle className="h-3.5 w-3.5" />
                  {stats.rejected_days} rejected
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rejected Records</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {attendanceRecords
                    .filter(r => r.user_id === userId && r.status === 'rejected' && 
                      new Date(r.date).getMonth() === month - 1 &&
                      new Date(r.date).getFullYear() === year)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div>
                          <p className="font-medium">{format(new Date(record.date), "MMM dd, yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.check_in_time 
                              ? `Check-in: ${format(new Date(record.check_in_time), "hh:mm a")}`
                              : "No check-in"}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          Rejected
                        </Badge>
                      </div>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
