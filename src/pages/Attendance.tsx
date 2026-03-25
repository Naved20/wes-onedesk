import { useEffect, useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay, isSunday } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, CheckCircle, XCircle, Clock, AlertTriangle, Eye } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { AttendanceCheckIn } from "@/components/attendance/AttendanceCheckIn";
import { AttendanceStats } from "@/components/attendance/AttendanceStats";
import { AttendanceApprovalDialog } from "@/components/attendance/AttendanceApprovalDialog";
import { HolidayManager } from "@/components/attendance/HolidayManager";
import { BulkAttendanceApproval } from "@/components/attendance/BulkAttendanceApproval";
import { getAttendanceStatusBadge, getAttendanceDisplayStatus } from "@/lib/attendanceUtils";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceWithEmployee extends Attendance {
  employee_name?: string;
}

interface Holiday {
  date: string;
  name: string;
}

export default function Attendance() {
  const { user, role } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithEmployee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceWithEmployee | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  const currentYear = selectedMonth.getFullYear();
  const currentMonth = selectedMonth.getMonth() + 1;

  useEffect(() => {
    fetchData();
  }, [role]);

  const fetchData = async () => {
    await Promise.all([fetchAttendance(), checkTodayAttendance(), fetchHolidays()]);
  };

  const fetchAttendance = async () => {
    try {
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .order("date", { ascending: false })
        .limit(100);

      if (error) throw error;

      // For managers and admins, fetch employee names
      if ((role === "admin" || role === "manager") && attendanceData && attendanceData.length > 0) {
        const userIds = [...new Set(attendanceData.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);

        const profileMap = new Map(
          profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
        );

        const recordsWithNames = attendanceData.map(record => ({
          ...record,
          employee_name: profileMap.get(record.user_id) || "Unknown",
        }));

        setAttendanceRecords(recordsWithNames);
      } else {
        setAttendanceRecords(attendanceData || []);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkTodayAttendance = async () => {
    if (!user) return;
    
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    setTodayCheckedIn(!!data);
  };

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from("holidays")
      .select("date, name")
      .order("date");
    
    setHolidays(data || []);
  };

  // Get dates for calendar highlighting
  const calendarModifiers = useMemo(() => {
    const approved: Date[] = [];
    const pending: Date[] = [];
    const rejected: Date[] = [];
    const halfDay: Date[] = [];
    const late: Date[] = [];
    const holidayDates: Date[] = holidays.map(h => new Date(h.date));

    attendanceRecords.forEach(record => {
      const date = new Date(record.date);
      if (record.status === "approved") {
        approved.push(date);
      } else if (record.status === "pending") {
        pending.push(date);
      } else if (record.status === "rejected") {
        rejected.push(date);
      }
      if (record.is_half_day) {
        halfDay.push(date);
      }
      if (record.is_late) {
        late.push(date);
      }
    });

    return { approved, pending, rejected, halfDay, late, holiday: holidayDates };
  }, [attendanceRecords, holidays]);

  const openApprovalDialog = (attendance: AttendanceWithEmployee) => {
    setSelectedAttendance(attendance);
    setApprovalDialogOpen(true);
  };

  const getStatusBadge = (record: AttendanceWithEmployee) => {
    const displayStatus = getAttendanceDisplayStatus(
      record.status,
      record.calculated_status,
      record.is_late
    );
    
    const statusBadge = getAttendanceStatusBadge(displayStatus, true);
    
    return (
      <div className="flex flex-wrap gap-1 items-center">
        <Badge variant={statusBadge.variant} className="font-mono">
          {statusBadge.label}
        </Badge>
        {record.is_half_day && (
          <Badge variant="secondary" className="text-xs">
            {record.half_day_type === "first_half" ? "1st Half" : "2nd Half"}
          </Badge>
        )}
        {record.status === "pending" && (
          <Badge variant="outline" className="text-xs">
            Pending Review
          </Badge>
        )}
      </div>
    );
  };

  // Custom modifiers styles for calendar
  const modifiersStyles = {
    approved: { 
      backgroundColor: "hsl(var(--chart-2))", 
      color: "hsl(var(--primary-foreground))",
      borderRadius: "50%"
    },
    pending: { 
      backgroundColor: "hsl(var(--chart-4))", 
      color: "hsl(var(--primary-foreground))",
      borderRadius: "50%"
    },
    rejected: { 
      backgroundColor: "hsl(var(--destructive))", 
      color: "hsl(var(--destructive-foreground))",
      borderRadius: "50%"
    },
    holiday: {
      backgroundColor: "hsl(var(--chart-5))",
      color: "hsl(var(--primary-foreground))",
      borderRadius: "50%"
    },
  };

  // Filter records for current month
  const monthRecords = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    return attendanceRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });
  }, [attendanceRecords, selectedMonth]);

  // Pending records for manager approval
  const pendingRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.status === "pending");
  }, [attendanceRecords]);

  // Late check-ins for review
  const lateRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.is_late && r.status === "pending");
  }, [attendanceRecords]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Track and manage attendance records</p>
        </div>

        {/* Employee Check-in Section */}
        {role === "employee" && user && (
          <AttendanceCheckIn
            userId={user.id}
            todayCheckedIn={todayCheckedIn}
            onCheckInComplete={() => {
              setTodayCheckedIn(true);
              fetchAttendance();
            }}
          />
        )}

        {/* Attendance Stats - Show for employee viewing their own stats */}
        {user && role === "employee" && (
          <AttendanceStats 
            userId={user.id} 
            year={currentYear} 
            month={currentMonth} 
          />
        )}

        {/* Manager/Admin View with Tabs */}
        {(role === "admin" || role === "manager") ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingRecords.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-500 text-white">
                    {pendingRecords.length}
                  </span>
                )}
              </TabsTrigger>
              {lateRecords.length > 0 && (
                <TabsTrigger value="late" className="relative">
                  Late Check-ins
                  <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-orange-500 text-white">
                    {lateRecords.length}
                  </span>
                </TabsTrigger>
              )}
              {role === "admin" && (
                <TabsTrigger value="holidays">Holidays</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      Attendance Calendar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      month={selectedMonth}
                      onMonthChange={setSelectedMonth}
                      modifiers={{
                        approved: (date) => calendarModifiers.approved.some(d => isSameDay(d, date)),
                        pending: (date) => calendarModifiers.pending.some(d => isSameDay(d, date)),
                        rejected: (date) => calendarModifiers.rejected.some(d => isSameDay(d, date)),
                        holiday: (date) => calendarModifiers.holiday.some(d => isSameDay(d, date)) || isSunday(date),
                      }}
                      modifiersStyles={modifiersStyles}
                      className="pointer-events-auto"
                    />
                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                        <span>Approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-4))" }} />
                        <span>Pending</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--destructive))" }} />
                        <span>Rejected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-5))" }} />
                        <span>Holiday</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Records Table */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Attendance Records</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : monthRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No attendance records for this month
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Check-in</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.employee_name || "-"}</TableCell>
                                <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>
                                  {record.check_in_time
                                    ? format(new Date(record.check_in_time), "hh:mm a")
                                    : "-"}
                                </TableCell>
                                <TableCell>{getStatusBadge(record)}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApprovalDialog(record)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Review
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pending">
              <BulkAttendanceApproval
                records={pendingRecords}
                onUpdate={fetchAttendance}
                userId={user?.id || ""}
              />
            </TabsContent>

            {lateRecords.length > 0 && (
              <TabsContent value="late">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Late Check-ins Requiring Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lateRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.employee_name || "-"}</TableCell>
                            <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                            <TableCell className="text-orange-600 dark:text-orange-400 font-medium">
                              {record.check_in_time
                                ? format(new Date(record.check_in_time), "hh:mm a")
                                : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {record.notes || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => openApprovalDialog(record)}
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {role === "admin" && (
              <TabsContent value="holidays">
                <HolidayManager />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          /* Employee View - Calendar and Records */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  My Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  modifiers={{
                    approved: (date) => calendarModifiers.approved.some(d => isSameDay(d, date)),
                    pending: (date) => calendarModifiers.pending.some(d => isSameDay(d, date)),
                    rejected: (date) => calendarModifiers.rejected.some(d => isSameDay(d, date)),
                    holiday: (date) => calendarModifiers.holiday.some(d => isSameDay(d, date)) || isSunday(date),
                  }}
                  modifiersStyles={modifiersStyles}
                  className="pointer-events-auto"
                />
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-4))" }} />
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-5))" }} />
                    <span>Holiday</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>My Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : monthRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No attendance records for this month
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthRecords.map((record) => {
                          const displayStatus = getAttendanceDisplayStatus(
                            record.status,
                            record.calculated_status,
                            record.is_late
                          );
                          const statusBadge = getAttendanceStatusBadge(displayStatus, true);
                          
                          return (
                            <TableRow key={record.id}>
                              <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                              <TableCell>
                                {record.check_in_time
                                  ? format(new Date(record.check_in_time), "hh:mm a")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadge.variant} className="font-mono">
                                  {statusBadge.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {record.is_half_day && (
                                    <Badge variant="secondary" className="text-xs">
                                      {record.half_day_type === "first_half" ? "1st Half" : "2nd Half"}
                                    </Badge>
                                  )}
                                  {record.status === "pending" && (
                                    <Badge variant="outline" className="text-xs">Pending</Badge>
                                  )}
                                  {record.status === "approved" && (
                                    <Badge className="bg-green-500 text-xs">Approved</Badge>
                                  )}
                                  {record.status === "rejected" && (
                                    <Badge variant="destructive" className="text-xs">Rejected</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <AttendanceApprovalDialog
        attendance={selectedAttendance}
        isOpen={approvalDialogOpen}
        onClose={() => {
          setApprovalDialogOpen(false);
          setSelectedAttendance(null);
        }}
        onUpdate={fetchAttendance}
        userId={user?.id || ""}
        isAdmin={role === "admin"}
      />
    </DashboardLayout>
  );
}
