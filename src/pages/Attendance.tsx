import { useEffect, useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay, isSunday } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckCircle, XCircle, AlertTriangle, Eye, Search, Clock, Zap, Gift, Palmtree, Check } from "lucide-react";
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
  calculated_status?: string | null;
  institution?: string | null;
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceWithEmployee | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDetailsOpen, setEmployeeDetailsOpen] = useState(false);
  const [employeeDialogMonth, setEmployeeDialogMonth] = useState<Date>(new Date());
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  const currentYear = selectedMonth.getFullYear();
  const currentMonth = selectedMonth.getMonth() + 1;

  useEffect(() => {
    fetchData();
    if (role === "admin" || role === "manager") {
      fetchInstitutions();
    }
  }, [role]);

  // Clear status filter when institution or date changes
  useEffect(() => {
    setSelectedStatusFilter(null);
  }, [selectedInstitution, selectedDate]);

  const fetchData = async () => {
    await Promise.all([
      fetchAttendance(), 
      checkTodayAttendance(), 
      fetchHolidays(),
      ...(role === "admin" || role === "manager" ? [fetchAllEmployees()] : [])
    ]);
  };

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("institution_assignment")
        .not("institution_assignment", "is", null);

      if (error) throw error;

      const uniqueInstitutions = [...new Set(
        data?.map(p => p.institution_assignment).filter(Boolean) as string[]
      )];
      
      setInstitutions(uniqueInstitutions);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    }
  };

  const fetchAttendance = async () => {
    try {
      // Fetch attendance for current month and previous month to ensure we have enough data
      const monthStart = startOfMonth(new Date());
      const twoMonthsAgo = new Date(monthStart);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", format(twoMonthsAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) throw error;

      console.log("Fetched attendance data:", attendanceData?.slice(0, 3)); // Log first 3 records
      
      // Debug: Log calculated_status values
      if (attendanceData && attendanceData.length > 0) {
        console.log("Sample record statuses:", attendanceData.slice(0, 3).map((r: any) => ({
          id: r.id,
          status: r.status,
          calculated_status: r.calculated_status,
          is_late: r.is_late
        })));
      }

      // For managers and admins, fetch employee names and institutions
      if ((role === "admin" || role === "manager") && attendanceData && attendanceData.length > 0) {
        const userIds = [...new Set(attendanceData.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name, institution_assignment")
          .in("user_id", userIds);

        const profileMap = new Map(
          profiles?.map(p => [
            p.user_id, 
            { 
              name: `${p.first_name} ${p.last_name}`,
              institution: p.institution_assignment 
            }
          ]) || []
        );

        const recordsWithNames = attendanceData.map(record => ({
          ...record,
          employee_name: profileMap.get(record.user_id)?.name || "Unknown",
          institution: profileMap.get(record.user_id)?.institution || null,
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
    const holidayDates: Date[] = holidays.map(h => new Date(h.date));
    return { holiday: holidayDates };
  }, [holidays]);

  const openApprovalDialog = (attendance: AttendanceWithEmployee) => {
    console.log("Opening dialog for attendance:", attendance.id, "is_late:", attendance.is_late);
    setSelectedAttendance(attendance);
    setApprovalDialogOpen(true);
  };

  const openEmployeeDetails = (userId: string) => {
    setSelectedEmployeeId(userId);
    setEmployeeDialogMonth(new Date()); // Reset to current month
    setEmployeeDetailsOpen(true);
  };

  const getStatusBadge = (record: AttendanceWithEmployee) => {
    // Check calculated_status first for direct status display
    const calculatedStatus = record.calculated_status?.toLowerCase();
    
    // Debug log
    if (record.employee_name?.includes("test") || Math.random() < 0.1) {
      console.log("Badge for:", record.employee_name, {
        status: record.status,
        calculated_status: record.calculated_status,
        calculatedStatus: calculatedStatus
      });
    }
    
    // If absent from calculated_status, show AB
    if (calculatedStatus === "absent") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="destructive" className="font-mono">
            AB
          </Badge>
          {record.status === "pending" && (
            <Badge variant="outline" className="text-xs">
              Pending Review
            </Badge>
          )}
        </div>
      );
    }
    
    // If half day (either from flag or calculated_status), show HD as main status
    if (record.is_half_day || calculatedStatus === "half_day") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="secondary" className="font-mono">
            HD
          </Badge>
          {record.is_late && (
            <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
              LT
            </Badge>
          )}
          {record.status === "pending" && (
            <Badge variant="outline" className="text-xs">
              Pending Review
            </Badge>
          )}
        </div>
      );
    }

    // Use calculated_status directly if it's one of the special types
    if (calculatedStatus === "paid_leave") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="secondary" className="font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
            PL
          </Badge>
          {record.status === "pending" && (
            <Badge variant="outline" className="text-xs">
              Pending Review
            </Badge>
          )}
        </div>
      );
    }

    if (calculatedStatus === "holiday") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="outline" className="font-mono bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
            HO
          </Badge>
          {record.status === "pending" && (
            <Badge variant="outline" className="text-xs">
              Pending Review
            </Badge>
          )}
        </div>
      );
    }

    if (calculatedStatus === "pending") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="secondary" className="font-mono">
            PD
          </Badge>
        </div>
      );
    }

    // Regular status display for present
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
        {record.is_late && displayStatus === "present" && (
          <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
            LT
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
    holiday: {
      backgroundColor: "hsl(var(--chart-5))",
      color: "hsl(var(--primary-foreground))",
      borderRadius: "50%"
    },
  };

  // Get all employees for absent calculation
  const [allEmployees, setAllEmployees] = useState<Array<{user_id: string, name: string, institution: string | null}>>([]);

  useEffect(() => {
    if (role === "admin" || role === "manager") {
      fetchAllEmployees();
    }
  }, [role]);

  const fetchAllEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, institution_assignment");

      if (error) throw error;

      const employees = data?.map(p => ({
        user_id: p.user_id,
        name: `${p.first_name} ${p.last_name}`,
        institution: p.institution_assignment
      })) || [];

      setAllEmployees(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Filter records for current month or selected date
  const monthRecords = useMemo(() => {
    let filtered = attendanceRecords;

    // If a specific date is selected, show only that date's records
    if (selectedDate) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return isSameDay(recordDate, selectedDate);
      });
    } else {
      // Otherwise show all records for the current month
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
    }

    // Apply institution filter
    if (selectedInstitution !== "all") {
      filtered = filtered.filter(record => 
        record.institution === selectedInstitution
      );
    }

    // Check if target date is a holiday (including Sundays)
    const isTargetDateHoliday = (dateStr: string) => {
      const date = new Date(dateStr);
      // Check if it's Sunday OR in holidays table
      return isSunday(date) || holidays.some(h => h.date === dateStr);
    };

    // Apply status filter
    if (selectedStatusFilter) {
      const targetDate = selectedDate || new Date();
      const targetDateStr = format(targetDate, "yyyy-MM-dd");
      const isHoliday = isTargetDateHoliday(targetDateStr);
      
      if (selectedStatusFilter === "present") {
        filtered = filtered.filter(record => {
          if (record.date !== targetDateStr) return false;
          // Check calculated_status for present/late, not approval status
          const calcStatus = record.calculated_status?.toLowerCase();
          return calcStatus === "present" || calcStatus === "late";
        });
      } else if (selectedStatusFilter === "absent") {
        // Don't show absent records if the date is a holiday
        if (isHoliday) {
          return [];
        }

        // Show employees who have calculated_status = absent
        filtered = filtered.filter(record => {
          if (record.date !== targetDateStr) return false;
          const calcStatus = record.calculated_status?.toLowerCase();
          return calcStatus === "absent";
        });
      } else if (selectedStatusFilter === "all") {
        // Show all employees (present + absent) for the selected date
        const targetDate = selectedDate || new Date();
        const targetDateStr = format(targetDate, "yyyy-MM-dd");
        
        filtered = filtered.filter(record => record.date === targetDateStr);
      }
    }

    return filtered;
  }, [attendanceRecords, selectedMonth, selectedDate, selectedInstitution, selectedStatusFilter, holidays]);

  // Apply employee search filter
  const searchFilteredRecords = useMemo(() => {
    if (!employeeSearchQuery.trim()) return monthRecords;
    
    return monthRecords.filter(record => 
      record.employee_name?.toLowerCase().includes(employeeSearchQuery.toLowerCase())
    );
  }, [monthRecords, employeeSearchQuery]);

  // Calculate daily stats for selected date or today
  const dailyStats = useMemo(() => {
    const targetDate = selectedDate || new Date();
    const targetDateStr = format(targetDate, "yyyy-MM-dd");
    
    // Check if target date is a holiday (including Sundays)
    const isHoliday = isSunday(targetDate) || holidays.some(h => h.date === targetDateStr);
    
    // Filter employees by institution first
    let employeesToCount = allEmployees;
    if (selectedInstitution !== "all") {
      employeesToCount = employeesToCount.filter(emp => 
        emp.institution === selectedInstitution
      );
    }
    
    // Total employees from employee_profiles (not just those with attendance records)
    const totalEmployees = employeesToCount.length;
    
    // Filter attendance records by institution
    let filteredRecords = attendanceRecords;
    if (selectedInstitution !== "all") {
      filteredRecords = filteredRecords.filter(record => 
        record.institution === selectedInstitution
      );
    }
    
    // Get today's attendance records
    const todayRecords = filteredRecords.filter(record => 
      record.date === targetDateStr
    );
    
    // Count present based on calculated_status (not approval status)
    const presentCount = todayRecords.filter(record => {
      const calcStatus = record.calculated_status?.toLowerCase();
      return calcStatus === "present" || calcStatus === "late";
    }).length;
    
    // Count half day based on calculated_status
    const halfDayCount = todayRecords.filter(record => {
      const calcStatus = record.calculated_status?.toLowerCase();
      return calcStatus === "half_day" || record.is_half_day;
    }).length;
    
    // Count absent based on calculated_status
    const absentCount = isHoliday ? 0 : todayRecords.filter(record => {
      const calcStatus = record.calculated_status?.toLowerCase();
      return calcStatus === "absent";
    }).length;
    
    return {
      total: totalEmployees,
      present: presentCount,
      halfDay: halfDayCount,
      absent: absentCount,
      date: targetDate,
      isHoliday: isHoliday
    };
  }, [attendanceRecords, selectedDate, selectedInstitution, allEmployees, holidays]);

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
          <>
            {/* Institution Filter */}
            {institutions.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="institution-filter" className="whitespace-nowrap">
                      Filter by Institution:
                    </Label>
                    <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                      <SelectTrigger id="institution-filter" className="w-[300px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Institutions</SelectItem>
                        {institutions.map((inst) => (
                          <SelectItem key={inst} value={inst}>
                            {inst}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedInstitution !== "all" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedInstitution("all")}
                      >
                        Clear Filter
                      </Button>
                    )}
                    <div className="relative ml-auto w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      month={selectedMonth}
                      onMonthChange={setSelectedMonth}
                      modifiers={{
                        holiday: (date) => calendarModifiers.holiday.some(d => isSameDay(d, date)) || isSunday(date),
                      }}
                      modifiersStyles={modifiersStyles}
                      className="pointer-events-auto"
                    />
                    <div className="mt-4 space-y-2">
                      {selectedDate && (
                        <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                          <span className="text-sm font-medium">
                            Showing: {format(selectedDate, "MMM dd, yyyy")}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDate(undefined)}
                            className="h-7 text-xs"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-5))" }} />
                          <span>Holiday</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Records Table */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Attendance Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Daily Stats - Compact and Clickable */}
                    <div className="grid grid-cols-3 gap-3">
                      <div 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          selectedStatusFilter === 'all' 
                            ? 'bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500' 
                            : 'bg-blue-50 dark:bg-blue-950/20'
                        }`}
                        onClick={() => setSelectedStatusFilter('all')}
                      >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Employees</p>
                          <p className="text-2xl font-bold">{dailyStats.total}</p>
                        </div>
                      </div>

                      <div 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          selectedStatusFilter === 'present' 
                            ? 'bg-green-50 dark:bg-green-950/20 ring-2 ring-green-500' 
                            : 'bg-green-50 dark:bg-green-950/20'
                        }`}
                        onClick={() => setSelectedStatusFilter('present')}
                      >
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Present</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dailyStats.present}</p>
                        </div>
                      </div>

                      <div 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          selectedStatusFilter === 'absent' 
                            ? 'bg-red-50 dark:bg-red-950/20 ring-2 ring-red-500' 
                            : 'bg-red-50 dark:bg-red-950/20'
                        }`}
                        onClick={() => !dailyStats.isHoliday && setSelectedStatusFilter('absent')}
                      >
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {dailyStats.isHoliday ? "Holiday" : "Absent"}
                          </p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {dailyStats.isHoliday ? "-" : dailyStats.absent}
                          </p>
                        </div>
                      </div>
                    </div>
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : searchFilteredRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {dailyStats.isHoliday ? (
                          <div className="space-y-2">
                            <p className="text-lg font-medium">🎉 Holiday</p>
                            <p>No attendance records for holidays</p>
                          </div>
                        ) : employeeSearchQuery ? (
                          "No employees match your search"
                        ) : selectedDate ? (
                          "No attendance records for this date"
                        ) : (
                          "No attendance records for this month"
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">S.No.</TableHead>
                              <TableHead>Employee</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Check-in</TableHead>
                              <TableHead>Check-out</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchFilteredRecords.map((record, index) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell 
                                  className="font-medium cursor-pointer hover:text-primary hover:underline"
                                  onClick={() => openEmployeeDetails(record.user_id)}
                                >
                                  {record.employee_name || "-"}
                                </TableCell>
                                <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>
                                  {record.check_in_time
                                    ? format(new Date(record.check_in_time), "hh:mm a")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {record.check_out_time
                                    ? format(new Date(record.check_out_time), "hh:mm a")
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
          </>
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
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  modifiers={{
                    holiday: (date) => calendarModifiers.holiday.some(d => isSameDay(d, date)) || isSunday(date),
                  }}
                  modifiersStyles={modifiersStyles}
                  className="pointer-events-auto"
                />
                <div className="mt-4 space-y-2">
                  {selectedDate && (
                    <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">
                        Showing: {format(selectedDate, "MMM dd, yyyy")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDate(undefined)}
                        className="h-7 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-5))" }} />
                      <span>Holiday</span>
                    </div>
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
                ) : searchFilteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {employeeSearchQuery ? "No employees match your search" : "No attendance records for this month"}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">S.No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchFilteredRecords.map((record, index) => {
                          // If half day, show HD as main status
                          if (record.is_half_day) {
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>
                                  {record.check_in_time
                                    ? format(new Date(record.check_in_time), "hh:mm a")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="font-mono">
                                    HD
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {record.is_late && (
                                      <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                                        LT
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
                          }

                          // Regular attendance display
                          const displayStatus = getAttendanceDisplayStatus(
                            record.status,
                            record.calculated_status,
                            record.is_late
                          );
                          const statusBadge = getAttendanceStatusBadge(displayStatus, true);
                          
                          return (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium text-muted-foreground">
                                {index + 1}
                              </TableCell>
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
                                <div className="flex gap-1 flex-wrap">
                                  {record.is_late && displayStatus === "present" && (
                                    <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                                      LT
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

      {/* Employee Details Dialog */}
      {selectedEmployeeId && (
        <Dialog open={employeeDetailsOpen} onOpenChange={setEmployeeDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {(() => {
                  const employeeRecord = attendanceRecords.find(r => r.user_id === selectedEmployeeId);
                  const employeeName = employeeRecord?.employee_name || "Employee";
                  return employeeName;
                })()}
              </DialogTitle>
            </DialogHeader>
            
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newMonth = new Date(employeeDialogMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setEmployeeDialogMonth(newMonth);
                }}
              >
                ← Previous
              </Button>
              <div className="text-center">
                <p className="font-semibold text-lg">
                  {format(employeeDialogMonth, "MMMM yyyy")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newMonth = new Date(employeeDialogMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setEmployeeDialogMonth(newMonth);
                }}
                disabled={employeeDialogMonth >= new Date()}
              >
                Next →
              </Button>
            </div>

            <div className="space-y-6">
              {/* Monthly Stats */}
              <AttendanceStats 
                userId={selectedEmployeeId} 
                year={employeeDialogMonth.getFullYear()} 
                month={employeeDialogMonth.getMonth() + 1}
                attendanceRecords={attendanceRecords}
              />
              
              {/* Attendance Records - Calendar View */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Records</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const monthRecords = attendanceRecords
                      .filter(r => {
                        if (r.user_id !== selectedEmployeeId) return false;
                        const recordDate = new Date(r.date);
                        return recordDate.getMonth() === employeeDialogMonth.getMonth() &&
                               recordDate.getFullYear() === employeeDialogMonth.getFullYear();
                      });

                    if (monthRecords.length === 0) {
                      return (
                        <p className="text-center text-muted-foreground py-8">
                          No attendance records for this month
                        </p>
                      );
                    }

                    // Create a map of date -> record for quick lookup
                    const recordMap = new Map(monthRecords.map(r => [r.date, r]));
                    
                    // Get first day of month and number of days
                    const firstDay = new Date(employeeDialogMonth.getFullYear(), employeeDialogMonth.getMonth(), 1);
                    const lastDay = new Date(employeeDialogMonth.getFullYear(), employeeDialogMonth.getMonth() + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    
                    // Create array of days
                    const days = [];
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(null);
                    }
                    for (let i = 1; i <= daysInMonth; i++) {
                      days.push(i);
                    }

                    return (
                      <div className="space-y-4">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-2 mb-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center font-semibold text-sm text-muted-foreground">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-2">
                          {days.map((day, index) => {
                            if (day === null) {
                              return <div key={`empty-${index}`} className="aspect-square" />;
                            }

                            const dateStr = format(
                              new Date(employeeDialogMonth.getFullYear(), employeeDialogMonth.getMonth(), day),
                              "yyyy-MM-dd"
                            );
                            const record = recordMap.get(dateStr);

                            // Determine display info
                            let displayInfo = '';
                            let displayColor = 'bg-muted border-muted-foreground/20 text-muted-foreground';
                            let StatusIcon = null;

                            if (record) {
                              const calcStatus = record.calculated_status?.toLowerCase();
                              
                              // Determine color and icon based on status
                              if (calcStatus === 'absent') {
                                displayColor = 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700';
                                StatusIcon = XCircle;
                              } else if (calcStatus === 'half_day' || record.is_half_day) {
                                displayColor = 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700';
                                StatusIcon = Zap;
                              } else if (calcStatus === 'paid_leave') {
                                displayColor = 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700';
                                StatusIcon = Palmtree;
                              } else if (calcStatus === 'holiday') {
                                displayColor = 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700';
                                StatusIcon = Gift;
                              } else if (record.is_late) {
                                displayColor = 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700';
                                StatusIcon = Clock;
                              } else {
                                displayColor = 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700';
                                StatusIcon = Check;
                              }

                              // Get time display
                              if (record.check_in_time) {
                                displayInfo = format(new Date(record.check_in_time), "hh:mm a");
                              }
                            }

                            return (
                              <Dialog key={day}>
                                <DialogTrigger asChild>
                                  <button
                                    className={`aspect-square p-2 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer flex flex-col items-center justify-center text-xs font-medium ${displayColor}`}
                                  >
                                    <span className="font-bold">{day}</span>
                                    {record && StatusIcon && (
                                      <>
                                        <StatusIcon className="h-5 w-5 mt-0.5" />
                                        {displayInfo && (
                                          <span className="text-xs mt-0.5 opacity-75">{displayInfo}</span>
                                        )}
                                      </>
                                    )}
                                  </button>
                                </DialogTrigger>
                                {record && (
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{format(new Date(record.date), "MMMM dd, yyyy")}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm text-muted-foreground">Check-in Time</p>
                                          <p className="text-lg font-semibold">
                                            {record.check_in_time
                                              ? format(new Date(record.check_in_time), "hh:mm a")
                                              : "-"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-sm text-muted-foreground">Check-out Time</p>
                                          <p className="text-lg font-semibold">
                                            {record.check_out_time
                                              ? format(new Date(record.check_out_time), "hh:mm a")
                                              : "-"}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Status and flags */}
                                      <div>
                                        <p className="text-sm text-muted-foreground mb-2">Status</p>
                                        <div className="flex flex-wrap gap-2">
                                          {getStatusBadge(record as AttendanceWithEmployee)}
                                        </div>
                                      </div>

                                      {/* Late indicator */}
                                      {record.is_late && (
                                        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3">
                                          <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                              Late Check-in
                                            </p>
                                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                              Checked in after 11:00 AM
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Half day indicator */}
                                      {(record.is_half_day || record.calculated_status?.toLowerCase() === 'half_day') && (
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
                                          <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                              Half Day
                                            </p>
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                              {record.half_day_type || 'Half day attendance'}
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Leave indicator */}
                                      {record.calculated_status?.toLowerCase() === 'paid_leave' && (
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                                          <Palmtree className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                              Paid Leave
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Holiday indicator */}
                                      {record.calculated_status?.toLowerCase() === 'holiday' && (
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-start gap-3">
                                          <Gift className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                              Holiday
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Absent indicator */}
                                      {record.calculated_status?.toLowerCase() === 'absent' && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                              Absent
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {record.notes && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Notes</p>
                                          <p className="text-sm">{record.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                )}
                              </Dialog>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
