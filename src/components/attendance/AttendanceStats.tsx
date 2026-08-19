import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  CalendarDays,
  AlertCircle,
  Gift
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { getPaidDaysFormula, summarizeAttendance } from "@/lib/paidDays";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceStatsProps {
  userId: string;
  year: number;
  month: number;
  attendanceRecords?: Attendance[];
  holidays?: Array<{ date: string; name: string }>;
  compactView?: boolean; // New prop to show compact summary view
}

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: string;
}

// RPC response type - exact match with calculate_attendance_stats function
interface AttendanceStatsRPC {
  present_days: number;
  present_on_time: number;
  late_days: number;
  late_sets: number;
  half_days: number;
  paid_leave_days: number;
  leave_days: number;
  holiday_count: number;
  absent_days: number;
  pending_days: number;
  rejected_days: number;
  total_paid_days: number;
  attendance_percentage: number;
  payroll_days: number;
}

export function AttendanceStats({ userId, year, month, attendanceRecords = [], holidays = [], compactView = false }: AttendanceStatsProps) {
  const [stats, setStats] = useState<AttendanceStatsRPC | null>(null);
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

  // Recalculate summary instantly whenever attendanceRecords prop updates
  useEffect(() => {
    if (attendanceRecords && attendanceRecords.length > 0) {
      const clientSummary = summarizeAttendance(attendanceRecords as any, year, month);
      setStats(prev => {
        if (!prev) return clientSummary as unknown as AttendanceStatsRPC;
        return {
          ...prev,
          ...clientSummary,
          holiday_count: prev.holiday_count > 0 ? prev.holiday_count : clientSummary.holiday_count,
        };
      });
    }
  }, [attendanceRecords, year, month]);

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
      console.log(`[AttendanceStats] Fetching RPC stats for user ${userId}, ${year}-${month}`);
      
      const { data, error } = await supabase.rpc('calculate_attendance_stats', {
        p_user_id: userId,
        p_year: year,
        p_month: month,
      });

      if (error) {
        console.error("[AttendanceStats] RPC error:", error);
      }
      
      const rpcStats = data ? (data as unknown as AttendanceStatsRPC) : null;
      if (attendanceRecords && attendanceRecords.length > 0) {
        const clientSummary = summarizeAttendance(attendanceRecords as any, year, month);
        setStats({
          ...(rpcStats || {}),
          ...clientSummary,
          holiday_count: rpcStats?.holiday_count ?? clientSummary.holiday_count ?? 0,
        } as AttendanceStatsRPC);
      } else if (rpcStats) {
        setStats(rpcStats);
      }
    } catch (error) {
      console.error("[AttendanceStats] Error fetching attendance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    if (compactView) {
      return <div className="animate-pulse h-32 bg-muted rounded-lg"></div>;
    }
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

  // Use ONLY RPC data - no local calculations
  const paidDaysInput = {
    present_days: stats.present_days,
    holiday_count: stats.holiday_count,
    half_days: stats.half_days,
    paid_leave_days: stats.paid_leave_days,
    late_days: stats.late_days,
    absent_days: stats.absent_days,
  };
  
  const paidDaysFormula = getPaidDaysFormula(paidDaysInput);

  // COMPACT VIEW - Like salary edit dialog
  if (compactView) {
    return (
      <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Attendance Summary
          </h4>
        </div>
        
        {/* First Row: Payroll Days, Present, Half Day, Paid Leave */}
        <div className="grid grid-cols-5 gap-4 text-sm mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Payroll Days</Label>
            <p className="font-semibold text-lg">{stats.payroll_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Present (PR)</Label>
            <p className="font-semibold text-lg text-green-600">{stats.present_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Half Day (HD)</Label>
            <p className="font-semibold text-lg text-orange-600">{stats.half_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Paid Leave (PL)</Label>
            <p className="font-semibold text-lg text-blue-600">{stats.paid_leave_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Absent (AB)</Label>
            <p className="font-semibold text-lg text-red-600">{stats.absent_days}</p>
          </div>
        </div>

        {/* Second Row: Holidays, Late Days, Leave, Late Sets */}
        <div className="grid grid-cols-5 gap-4 text-sm mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Holidays (HO)</Label>
            <p className="font-semibold text-lg text-purple-600">{stats.holiday_count}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Leave (LE)</Label>
            <p className="font-semibold text-lg text-pink-600">{stats.leave_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Late Days (LT)</Label>
            <p className="font-semibold text-lg text-yellow-700">{stats.late_days}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Late Sets (LS)</Label>
            <p className="font-semibold text-lg text-yellow-700">{stats.late_sets}</p>
          </div>
          <div></div>
        </div>

        {/* Total Paid Days */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Total Paid Days:</span>
            <span className="text-lg font-bold text-primary">
              {stats.total_paid_days.toFixed(1)} days
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {paidDaysFormula}</p>
        </div>
      </div>
    );
  }

  // ORIGINAL GRID VIEW
  return (
    <div className="space-y-4">
      {/* Stats Grid - New Design */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Payroll Days - Total days in month */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-muted-foreground">Payroll Days</span>
            </div>
            <p className="text-2xl font-bold">{stats.payroll_days}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total days in month
            </p>
          </CardContent>
        </Card>

        {/* Present (PR) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Present (PR)</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.present_days}
            </p>
          </CardContent>
        </Card>

        {/* Half Day (HD) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Half Day (HD)</span>
            </div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.half_days}
            </p>
          </CardContent>
        </Card>

        {/* Holiday (HO) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Holiday (HO)</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.holiday_count}
            </p>
          </CardContent>
        </Card>

        {/* Paid Leave (PL) */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Paid Leave (PL)</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.paid_leave_days}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paid Leaves (PL)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'casual' || l.leave_type === 'medical').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No paid leaves this month</p>
              ) : (
                leaves
                  .filter(l => l.leave_type === 'casual' || l.leave_type === 'medical')
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
                        {leave.leave_type === 'medical' ? 'Medical (PL)' : 'PL'}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Leave (LE) - Sick Leaves */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Leave (LE)</span>
                </div>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {stats.leave_days}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leaves (LE)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'sick' || l.leave_type === 'emergency' || l.leave_type === 'lop').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No leaves this month</p>
              ) : (
                leaves
                  .filter(l => l.leave_type === 'sick' || l.leave_type === 'emergency' || l.leave_type === 'lop')
                  .map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg bg-cyan-50 dark:bg-cyan-950/20">
                      <div>
                        <p className="font-medium">
                          {format(new Date(leave.start_date), "MMM dd, yyyy")}
                          {leave.start_date !== leave.end_date && ` - ${format(new Date(leave.end_date), "MMM dd, yyyy")}`}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground">{leave.reason}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={leave.leave_type === 'emergency' ? 'bg-red-100 dark:bg-red-900/30 text-red-800' : 'bg-cyan-100 dark:bg-cyan-900/30'}>
                        {leave.leave_type === 'emergency' ? 'Emergency (LE)' : 'LE'}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Absent (AB) */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Absent (AB)</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats.absent_days}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Absent Days (AB)</DialogTitle>
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
                      <Badge variant="destructive">AB</Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Lates (LT) */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Lates (LT)</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.late_days}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Late Check-ins (LT)</DialogTitle>
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
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30">LT</Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Late Sets */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Late Sets</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.late_sets}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              3 lates = 1 set
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Paid Day Units - Summary Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Paid Day Units</p>
              <p className="text-4xl font-bold text-primary">
                {stats.total_paid_days.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {paidDaysFormula}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Payroll Utilization</p>
              <p className={`text-3xl font-bold ${getPercentageColor(stats.attendance_percentage)}`}>
                {stats.attendance_percentage.toFixed(1)}%
              </p>
              <Progress 
                value={stats.attendance_percentage} 
                className="h-2 w-32 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_paid_days.toFixed(1)} / {stats.payroll_days} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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