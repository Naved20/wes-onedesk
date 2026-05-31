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
  AlertCircle,
  Gift
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceStatsProps {
  userId: string;
  year: number;
  month: number;
  attendanceRecords?: Attendance[];
  holidays?: Array<{ date: string; name: string }>;
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
  total_days_in_month?: number; // Added for payroll days (total days in month)
}

export function AttendanceStats({ userId, year, month, attendanceRecords = [], holidays = [] }: AttendanceStatsProps) {
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
      
      // Calculate total days in month
      const totalDaysInMonth = new Date(year, month, 0).getDate();
      
      setStats({
        ...(data as unknown as Stats),
        total_days_in_month: totalDaysInMonth
      });
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Note: Holiday count is now fetched from attendance table with status = 'holiday'
  // This is handled in the calculate_attendance_stats RPC function
  // No separate holiday fetch needed anymore

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
            <p className="text-2xl font-bold">{stats.total_days_in_month || 31}</p>
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
              {(() => {
                // Get all holidays in this month
                const holidaysInMonth = holidays.filter(h => {
                  const hDate = new Date(h.date);
                  return hDate.getMonth() === month - 1 && hDate.getFullYear() === year;
                });
                
                // Find holidays where the user was present
                const holidaysWorked = attendanceRecords.filter(r => {
                  if (r.user_id !== userId) return false;
                  if (new Date(r.date).getMonth() !== month - 1) return false;
                  if (new Date(r.date).getFullYear() !== year) return false;
                  
                  const recordDate = new Date(r.date).toISOString().split('T')[0];
                  const isHolidayDate = holidays.some(h => new Date(h.date).toISOString().split('T')[0] === recordDate);
                  
                  const calcStatus = r.calculated_status?.toLowerCase();
                  const isPresent = calcStatus === 'present' || calcStatus === 'late' || calcStatus === 'half_day' || r.is_half_day || r.is_late || calcStatus === 'paid_leave';
                  
                  return isHolidayDate && isPresent && r.status !== 'rejected';
                });
                
                // Return total holidays minus holidays worked
                return holidaysInMonth.length - holidaysWorked.length;
              })()}
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
                  {stats.casual_leaves}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paid Leaves (PL)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'casual' || l.leave_type === 'emergency').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No paid leaves this month</p>
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
                        PL
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
                  {stats.sick_leaves}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leaves (LE)</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {leaves.filter(l => l.leave_type === 'sick').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No leaves this month</p>
              ) : (
                leaves
                  .filter(l => l.leave_type === 'sick')
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
                      <Badge variant="outline" className="bg-cyan-100 dark:bg-cyan-900/30">
                        LE
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
              {Math.floor(stats.late_days / 2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              2 lates = 1 set
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
                {(stats.present_days + stats.half_days + stats.casual_leaves).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Present ({stats.present_days}) + Half Day ({stats.half_days}) + Paid Leave ({stats.casual_leaves})
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Payroll Utilization</p>
              <p className={`text-3xl font-bold ${getPercentageColor(
                ((stats.present_days + stats.half_days + stats.casual_leaves) / (stats.total_days_in_month || 31)) * 100
              )}`}>
                {(((stats.present_days + stats.half_days + stats.casual_leaves) / (stats.total_days_in_month || 31)) * 100).toFixed(1)}%
              </p>
              <Progress 
                value={((stats.present_days + stats.half_days + stats.casual_leaves) / (stats.total_days_in_month || 31)) * 100} 
                className="h-2 w-32 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {(stats.present_days + stats.half_days + stats.casual_leaves).toFixed(1)} / {stats.total_days_in_month || 31} days
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
