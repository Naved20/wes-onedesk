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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckCircle, XCircle, AlertTriangle, Eye, Search } from "lucide-react";
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

  const getStatusBadge = (record: AttendanceWithEmployee) => {
    // If half day, show HD as main status
    if (record.is_half_day) {
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

    // Regular status display
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

    // Apply status filter
    if (selectedStatusFilter) {
      const targetDate = selectedDate || new Date();
      const targetDateStr = format(targetDate, "yyyy-MM-dd");
      
      if (selectedStatusFilter === "present") {
        filtered = filtered.filter(record => {
          if (record.date !== targetDateStr) return false;
          return (record.status === "approved" || record.status === "pending") &&
                 (record.calculated_status === "present" || record.calculated_status === "late" || !record.calculated_status);
        });
      } else if (selectedStatusFilter === "absent") {
        // For absent, show both:
        // 1. Employees who checked in but are marked absent/rejected
        // 2. Employees who didn't check in at all
        const targetDate = selectedDate || new Date();
        const targetDateStr = format(targetDate, "yyyy-MM-dd");
        
        // Get today's attendance records
        const todayRecords = attendanceRecords.filter(r => r.date === targetDateStr);
        
        // Apply institution filter
        let filteredTodayRecords = todayRecords;
        if (selectedInstitution !== "all") {
          filteredTodayRecords = todayRecords.filter(record => 
            record.institution === selectedInstitution
          );
        }
        
        // Get employees who are marked absent (rejected or calculated_status = absent)
        const markedAbsent = filteredTodayRecords.filter(record =>
          record.status === "rejected" || record.calculated_status === "absent"
        );
        
        // Get employees who checked in today
        const checkedInUserIds = new Set(todayRecords.map(r => r.user_id));

        // Filter employees based on institution
        let employeesToCheck = allEmployees;
        if (selectedInstitution !== "all") {
          employeesToCheck = employeesToCheck.filter(emp => emp.institution === selectedInstitution);
        }

        // Find employees who didn't check in at all
        const didNotCheckIn = employeesToCheck.filter(emp => !checkedInUserIds.has(emp.user_id));

        // Create fake attendance records for employees who didn't check in
        const absentRecords: AttendanceWithEmployee[] = didNotCheckIn.map(emp => ({
          id: `absent-${emp.user_id}`,
          user_id: emp.user_id,
          date: targetDateStr,
          check_in_time: null,
          check_out_time: null,
          status: "rejected",
          calculated_status: "absent",
          is_late: false,
          is_half_day: false,
          half_day_type: null,
          notes: null,
          shift_id: null,
          is_manual_override: false,
          modified_by: null,
          created_at: targetDateStr,
          updated_at: targetDateStr,
          employee_name: emp.name,
          institution: emp.institution,
          admin_override: null,
          approved_at: null,
          approved_by: null,
          modified_at: null,
          rejection_reason: null,
          late_reason: null,
          overtime_hours: null,
          original_status: null,
          presence_value: null
        }));

        // Combine marked absent and didn't check in
        return [...markedAbsent, ...absentRecords];
      } else if (selectedStatusFilter === "all") {
        // Show all employees (present + absent) for today
        const targetDate = selectedDate || new Date();
        const targetDateStr = format(targetDate, "yyyy-MM-dd");
        
        // Get today's attendance records
        const todayRecords = attendanceRecords.filter(r => r.date === targetDateStr);
        
        // Apply institution filter to today's records
        let filteredTodayRecords = todayRecords;
        if (selectedInstitution !== "all") {
          filteredTodayRecords = todayRecords.filter(record => 
            record.institution === selectedInstitution
          );
        }
        
        // Get employees who checked in today
        const checkedInUserIds = new Set(todayRecords.map(r => r.user_id));

        // Filter employees based on institution
        let employeesToCheck = allEmployees;
        if (selectedInstitution !== "all") {
          employeesToCheck = employeesToCheck.filter(emp => emp.institution === selectedInstitution);
        }

        // Find absent employees (those who didn't check in)
        const absentEmployees = employeesToCheck.filter(emp => !checkedInUserIds.has(emp.user_id));

        // Create fake attendance records for absent employees
        const absentRecords: AttendanceWithEmployee[] = absentEmployees.map(emp => ({
          id: `absent-${emp.user_id}`,
          user_id: emp.user_id,
          date: targetDateStr,
          check_in_time: null,
          check_out_time: null,
          status: "rejected",
          calculated_status: "absent",
          is_late: false,
          is_half_day: false,
          half_day_type: null,
          notes: null,
          shift_id: null,
          is_manual_override: false,
          modified_by: null,
          created_at: targetDateStr,
          updated_at: targetDateStr,
          employee_name: emp.name,
          institution: emp.institution,
          admin_override: null,
          approved_at: null,
          approved_by: null,
          modified_at: null,
          rejection_reason: null,
          late_reason: null,
          overtime_hours: null,
          original_status: null,
          presence_value: null
        }));

        // Combine present and absent records
        return [...filteredTodayRecords, ...absentRecords];
      }
    }

    return filtered;
  }, [attendanceRecords, selectedMonth, selectedDate, selectedInstitution, selectedStatusFilter, allEmployees]);

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
    
    // Count present (approved or pending with present/late status)
    const presentCount = todayRecords.filter(record => 
      (record.status === "approved" || record.status === "pending") &&
      (record.calculated_status === "present" || record.calculated_status === "late" || !record.calculated_status)
    ).length;
    
    // Count half day
    const halfDayCount = todayRecords.filter(record => 
      record.is_half_day && (record.status === "approved" || record.status === "pending")
    ).length;
    
    // Absent = Total - Present - HalfDay
    const absentCount = Math.max(0, totalEmployees - presentCount);
    
    return {
      total: totalEmployees,
      present: presentCount,
      halfDay: halfDayCount,
      absent: absentCount,
      date: targetDate
    };
  }, [attendanceRecords, selectedDate, selectedInstitution, allEmployees]);

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
                        onClick={() => setSelectedStatusFilter('absent')}
                      >
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Absent</p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{dailyStats.absent}</p>
                        </div>
                      </div>
                    </div>
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
                              <TableHead>Employee</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Check-in</TableHead>
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
    </DashboardLayout>
  );
}
