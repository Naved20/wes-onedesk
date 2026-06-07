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
import { AttendanceStats } from "@/components/attendance/AttendanceStats";
import { AttendanceApprovalDialog } from "@/components/attendance/AttendanceApprovalDialog";
import { HolidayManager } from "@/components/attendance/HolidayManager";
import { BulkAttendanceApproval } from "@/components/attendance/BulkAttendanceApproval";
import { getAttendanceStatusBadge, getAttendanceDisplayStatus } from "@/lib/attendanceUtils";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

interface AttendanceWithEmployee extends Omit<Attendance, 'calculated_status'> {
  employee_name?: string;
  calculated_status?: string | null;
  institution?: string | null;
  shift_name?: string;
}

interface Holiday {
  date: string;
  name: string;
}

interface Leave {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  is_half_day: boolean;
}

export default function Attendance() {
  const { user, role } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithEmployee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceWithEmployee | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDetailsOpen, setEmployeeDetailsOpen] = useState(false);
  const [employeeDialogMonth, setEmployeeDialogMonth] = useState<Date>(new Date());
  const [employeeShiftInfo, setEmployeeShiftInfo] = useState<any>(null);
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
      fetchLeaves(),
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
      // Fetch attendance for current year to show all records
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", format(yearStart, "yyyy-MM-dd"))
        .neq("status", "holiday")  // EXCLUDE holiday records - they're fetched separately
        .order("date", { ascending: false });

      if (error) throw error;

      console.log("📊 Fetched attendance data (excluding holidays):");
      console.log("  Total records:", attendanceData?.length || 0);
      console.log("  Year filter:", format(yearStart, "yyyy-MM-dd"));
      
      if (attendanceData && attendanceData.length > 0) {
        console.log("  First 3 records:", attendanceData.slice(0, 3));
        
        // Count by status
        const statusCounts = attendanceData.reduce((acc: any, r: any) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        console.log("  Status breakdown:", statusCounts);
        
        // Show date range
        const dates = attendanceData.map((r: any) => r.date).sort();
        console.log("  Date range:", dates[0], "to", dates[dates.length - 1]);
      } else {
        console.warn("⚠️ No attendance records found! Check if:");
        console.warn("  1. Employees have checked in");
        console.warn("  2. Year filter is correct:", format(yearStart, "yyyy-MM-dd"));
        console.warn("  3. All records might have status='holiday'");
      }

      // For managers and admins, fetch employee names and institutions
      if ((role === "admin" || role === "manager") && attendanceData && attendanceData.length > 0) {
        const userIds = [...new Set(attendanceData.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name, institution_assignment")
          .in("user_id", userIds);

        // Fetch shift information for each attendance record
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, name");

        const shiftMap = new Map(shifts?.map(s => [s.id, s.name]) || []);

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
          shift_name: record.shift_id ? shiftMap.get(record.shift_id) || "Unknown" : "-",
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
    console.log("🔍 Fetching holidays...");
    try {
      // METHOD 1: Try holidays_view first (recommended after merge)
      const { data: viewData, error: viewError } = await supabase
        .from("holidays_view")
        .select("date, name")  // ← FIXED: column is 'name', not 'holiday_name'
        .order("date");

      console.log("holidays_view attempt:", { 
        success: !viewError, 
        recordCount: viewData?.length || 0,
        error: viewError?.message 
      });

      if (!viewError && viewData && viewData.length > 0) {
        console.log("✅ Using holidays_view for holiday data");
        console.log("Sample holidays:", viewData.slice(0, 3));
        
        const holidays: Holiday[] = viewData.map((h: any) => ({
          date: h.date,
          name: h.name || "Holiday"  // ← FIXED: use 'name' field
        }));
        
        setHolidays(holidays);
        console.log("Total holidays set:", holidays.length);
        return;
      }

      // METHOD 2: Try old holidays table
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("holidays")
        .select("date, name")
        .order("date");

      console.log("holidays table attempt:", { 
        success: !holidaysError, 
        recordCount: holidaysData?.length || 0,
        error: holidaysError?.message 
      });

      if (!holidaysError && holidaysData) {
        console.log("✅ Using holidays table for holiday data");
        console.log("Sample holidays:", holidaysData.slice(0, 3));
        
        const holidays: Holiday[] = holidaysData.map(h => ({
          date: h.date,
          name: h.name
        }));
        
        setHolidays(holidays);
        console.log("Total holidays set:", holidays.length);
        return;
      }

      // METHOD 3: Fallback to attendance table with status='holiday'
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("date, holiday_name")
        .eq("status", "holiday")
        .order("date");

      console.log("attendance (status=holiday) attempt:", { 
        success: !attendanceError, 
        recordCount: attendanceData?.length || 0,
        error: attendanceError?.message 
      });

      if (attendanceData && attendanceData.length > 0) {
        console.log("✅ Using attendance table for holiday data");
        
        // Get unique holidays by date
        const uniqueHolidaysMap = new Map<string, string>();
        attendanceData.forEach((h: any) => {
          if (!uniqueHolidaysMap.has(h.date)) {
            uniqueHolidaysMap.set(h.date, h.holiday_name || "Holiday");
          }
        });

        const holidays: Holiday[] = Array.from(uniqueHolidaysMap.entries()).map(([date, name]) => ({
          date,
          name
        }));
        
        console.log("Sample holidays:", holidays.slice(0, 3));
        setHolidays(holidays);
        console.log("Total holidays set:", holidays.length);
        return;
      }

      console.warn("⚠️ No holidays found in any table/view");
      setHolidays([]);
    } catch (error) {
      console.error("❌ Error fetching holidays:", error);
      setHolidays([]);
    }
  };

  const fetchLeaves = async () => {
    try {
      // Fetch leaves for current and previous months
      const monthStart = startOfMonth(new Date());
      const twoMonthsAgo = new Date(monthStart);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      let query = supabase
        .from("leaves")
        .select("*")
        .gte("start_date", format(twoMonthsAgo, "yyyy-MM-dd"))
        .eq("status", "approved")
        .order("start_date", { ascending: false });

      // If employee, only fetch own leaves
      if (role === "employee" && user) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeaves(data || []);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
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
    fetchEmployeeShiftInfo(userId);
  };

  const fetchEmployeeShiftInfo = async (userId: string) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.rpc("get_employee_shift", {
        p_user_id: userId,
        p_date: today,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setEmployeeShiftInfo(data[0]);
      }
    } catch (error) {
      console.error("Error fetching employee shift:", error);
    }
  };

  const getStatusBadge = (record: AttendanceWithEmployee) => {
    // Check calculated_status first for direct status display
    const calculatedStatus = record.calculated_status?.toLowerCase();
    
    // Check if this date is a holiday (now includes Sundays from database)
    const recordDate = new Date(record.date).toISOString().split('T')[0];
    const isHoliday = holidays.some(h => new Date(h.date).toISOString().split('T')[0] === recordDate);
    
    // Debug log
    if (record.employee_name?.includes("test") || Math.random() < 0.1) {
      console.log("Badge for:", record.employee_name, {
        status: record.status,
        calculated_status: record.calculated_status,
        calculatedStatus: calculatedStatus,
        isHoliday: isHoliday
      });
    }
    
    // If absent on a holiday, show HO (Holiday) instead of AB
    if (calculatedStatus === "absent" && isHoliday) {
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

    if (calculatedStatus === "leave") {
      return (
        <div className="flex flex-wrap gap-1 items-center">
          <Badge variant="secondary" className="font-mono bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700">
            LE
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
        .select("user_id, first_name, last_name, institution_assignment")
        .eq("is_active", true);

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

    console.log("Total attendance records:", attendanceRecords.length);
    
    if (attendanceRecords.length > 0) {
      const firstRecord = attendanceRecords[0];
      console.log("FIRST RECORD FULL:", firstRecord);
      console.log("First record date:", firstRecord.date, "Type:", typeof firstRecord.date);
    }
    
    console.log("Sample records:", attendanceRecords.slice(0, 5).map(r => ({
      date: r.date,
      dateType: typeof r.date,
      status: r.status,
      calculated_status: r.calculated_status,
      employee: r.employee_name,
      check_in: r.check_in_time
    })));
    console.log("Selected month:", selectedMonth);
    console.log("Month start:", startOfMonth(selectedMonth));
    console.log("Month end:", endOfMonth(selectedMonth));

    // If a specific date is selected, show only that date's records
    if (selectedDate) {
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      console.log("Filtering by specific date:", selectedDateStr);
      filtered = filtered.filter(record => {
        const matches = record.date === selectedDateStr;
        if (!matches && Math.random() < 0.01) { // Log 1% of mismatches
          console.log("Date mismatch:", record.date, "!==", selectedDateStr);
        }
        return matches;
      });
    } else {
      // Otherwise show all records for the current month
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");
      
      console.log("Filtering by month range:", monthStartStr, "to", monthEndStr);
      console.log("First 3 record dates:", attendanceRecords.slice(0, 3).map(r => r.date));
      
      filtered = filtered.filter(record => {
        const matches = record.date >= monthStartStr && record.date <= monthEndStr;
        if (!matches && Math.random() < 0.01) { // Log 1% of mismatches
          console.log("Range mismatch:", record.date, "not in range", monthStartStr, "to", monthEndStr);
        }
        return matches;
      });
    }

    console.log("After date filter:", filtered.length);

    // Note: Holiday records are already excluded in the fetchAttendance query
    // No need to filter them here again

    // Apply institution filter
    if (selectedInstitution !== "all") {
      filtered = filtered.filter(record => 
        record.institution === selectedInstitution
      );
      console.log("After institution filter:", filtered.length);
    }

    // Check if target date is a holiday (now includes Sundays from database)
    const isTargetDateHoliday = (dateStr: string) => {
      return holidays.some(h => h.date === dateStr);
    };

    // Apply status filter
    if (selectedStatusFilter) {
      const targetDate = selectedDate || new Date();
      const targetDateStr = format(targetDate, "yyyy-MM-dd");
      const isHoliday = isTargetDateHoliday(targetDateStr);
      
      console.log("Status filter active:", selectedStatusFilter);
      
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
      } else if (selectedStatusFilter === "paid_leave") {
        filtered = filtered.filter(record => {
          if (record.date !== targetDateStr) return false;
          const calcStatus = record.calculated_status?.toLowerCase();
          return calcStatus === "paid_leave";
        });
      } else if (selectedStatusFilter === "leave") {
        filtered = filtered.filter(record => {
          if (record.date !== targetDateStr) return false;
          const calcStatus = record.calculated_status?.toLowerCase();
          return calcStatus === "leave";
        });
      } else if (selectedStatusFilter === "all") {
        // Show all employees (present + absent) for the selected date
        const targetDate = selectedDate || new Date();
        const targetDateStr = format(targetDate, "yyyy-MM-dd");
        
        filtered = filtered.filter(record => record.date === targetDateStr);
      }
      
      console.log("After status filter:", filtered.length);
    }

    console.log("Final filtered records:", filtered.length);
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
    
    // Check if target date is a holiday - fetch from attendance table
    const isHoliday = attendanceRecords.some(r => 
      r.date === targetDateStr && r.status === 'holiday'
    );
    
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
    
    // Use the SAME logic as the row badges (getAttendanceDisplayStatus) so
    // counters always match what's visible in the table.
    const displayStatuses = todayRecords.map(record =>
      getAttendanceDisplayStatus(record.status, record.calculated_status, record.is_late)
    );

    const presentCount = displayStatuses.filter(s => s === "present").length;
    const halfDayCount = displayStatuses.filter(s => s === "half_day").length
      + todayRecords.filter(r => r.is_half_day && getAttendanceDisplayStatus(r.status, r.calculated_status, r.is_late) !== "half_day").length;
    const paidLeaveCount = displayStatuses.filter(s => s === "paid_leave").length;
    const leaveCount = displayStatuses.filter(s => s === "leave").length;
    const absentCount = isHoliday ? 0 : displayStatuses.filter(s => s === "absent").length;
    
    return {
      total: totalEmployees,
      present: presentCount,
      halfDay: halfDayCount,
      paidLeave: paidLeaveCount,
      leave: leaveCount,
      absent: absentCount,
      date: targetDate,
      isHoliday: isHoliday
    };
  }, [attendanceRecords, selectedDate, selectedInstitution, allEmployees]);

  // Unique holidays for the selected month to prevent double counting
  const uniqueHolidaysInMonth = useMemo(() => {
    const monthHolidays = holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate.getFullYear() === selectedMonth.getFullYear() && 
             hDate.getMonth() === selectedMonth.getMonth();
    });
    
    // Deduplicate by date
    const uniqueDates = new Set();
    const deduplicated = [];
    for (const h of monthHolidays) {
      if (!uniqueDates.has(h.date)) {
        uniqueDates.add(h.date);
        deduplicated.push(h);
      }
    }
    return deduplicated;
  }, [holidays, selectedMonth]);

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

        {/* Attendance Stats - Show for employee viewing their own stats */}
        {user && role === "employee" && (
          <AttendanceStats 
            userId={user.id} 
            year={currentYear} 
            month={currentMonth}
            attendanceRecords={attendanceRecords}
            holidays={holidays}
            compactView={true}
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
                  <CardContent className="space-y-4">
                    {/* Month and Year Filters */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1 block">Month</Label>
                        <Select 
                          value={String(currentMonth)} 
                          onValueChange={(val) => setSelectedMonth(new Date(currentYear, Number(val) - 1))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              { value: 1, label: 'January' },
                              { value: 2, label: 'February' },
                              { value: 3, label: 'March' },
                              { value: 4, label: 'April' },
                              { value: 5, label: 'May' },
                              { value: 6, label: 'June' },
                              { value: 7, label: 'July' },
                              { value: 8, label: 'August' },
                              { value: 9, label: 'September' },
                              { value: 10, label: 'October' },
                              { value: 11, label: 'November' },
                              { value: 12, label: 'December' },
                            ].map((month) => (
                              <SelectItem key={month.value} value={String(month.value)}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1 block">Year</Label>
                        <Select 
                          value={String(currentYear)} 
                          onValueChange={(val) => setSelectedMonth(new Date(Number(val), currentMonth - 1))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              new Date().getFullYear() - 1,
                              new Date().getFullYear(),
                              new Date().getFullYear() + 1,
                            ].map((year) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Calendar */}
                    <div>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        month={selectedMonth}
                        onMonthChange={setSelectedMonth}
                        modifiers={{
                          holiday: (date) => calendarModifiers.holiday.some(d => isSameDay(d, date)),
                        }}
                        modifiersStyles={modifiersStyles}
                        className="pointer-events-auto"
                      />
                    </div>

                    {/* Legend and Info */}
                    <div className="space-y-2">
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
                    {/* Compact Stats Grid - Like Salary Edit Dialog */}
                    <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800">
                      <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Daily Attendance Summary - {selectedDate ? format(selectedDate, "MMM dd, yyyy") : format(new Date(), "MMM dd, yyyy")}
                      </h4>
                      
                      {/* First Row: Total, Present, Paid Leave, Leave, Absent */}
                      <div className="grid grid-cols-5 gap-5 mx-5 text-sm mb-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Total</Label>
                          <p className="font-semibold text-lg text-blue-600">{dailyStats.total}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Present (PR)</Label>
                          <p className="font-semibold text-lg text-green-600">{dailyStats.present}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Paid Leave (PL)</Label>
                          <p className="font-semibold text-lg text-blue-500">{dailyStats.paidLeave}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Leave (LE)</Label>
                          <p className="font-semibold text-lg text-cyan-600">{dailyStats.leave}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">{dailyStats.isHoliday ? "Holiday (HO)" : "Absent (AB)"}</Label>
                          <p className={`font-semibold text-lg ${dailyStats.isHoliday ? 'text-purple-600' : 'text-red-600'}`}>
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
                        {employeeSearchQuery ? (
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
                              <TableHead>Shift</TableHead>
                              <TableHead>Check-in</TableHead>
                              <TableHead>Check-out</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchFilteredRecords.map((record, index) => (
                              <TableRow 
                                key={record.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => openApprovalDialog(record)}
                              >
                                <TableCell className="font-medium text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell 
                                  className="font-medium cursor-pointer hover:text-primary hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEmployeeDetails(record.user_id);
                                  }}
                                >
                                  {record.employee_name || "-"}
                                </TableCell>
                                <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                                <TableCell className="text-sm">
                                  {record.shift_name || "-"}
                                </TableCell>
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openApprovalDialog(record);
                                    }}
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
                          <TableRow 
                            key={record.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => openApprovalDialog(record)}
                          >
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openApprovalDialog(record);
                                }}
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
                              <TableRow 
                                key={record.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  setSelectedAttendance(record);
                                  setApprovalDialogOpen(true);
                                }}
                              >
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
                            <TableRow 
                              key={record.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => {
                                setSelectedAttendance(record);
                                setApprovalDialogOpen(true);
                              }}
                            >
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



                            {/* Month Summary - Top Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Summary Stats */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {format(selectedMonth, "MMM yyyy")} Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Total Days</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">31</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Sundays</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {uniqueHolidaysInMonth.filter(h => h.name === 'Sunday').length}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Holidays</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {uniqueHolidaysInMonth.length}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Working Days</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {31 - uniqueHolidaysInMonth.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Holidays List */}
            {uniqueHolidaysInMonth.length > 0 && (
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-purple-900 dark:text-purple-100">
                    Holidays in {format(selectedMonth, "MMM")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {uniqueHolidaysInMonth.map(holiday => (
                      <div key={holiday.date} className="flex justify-between items-center p-1.5 bg-white dark:bg-slate-800 rounded border border-purple-200 dark:border-purple-700 hover:shadow-sm transition-shadow">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{holiday.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-2 flex-shrink-0">{format(new Date(holiday.date), "MMM dd")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            
          </div>
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
              {/* Shift Information */}
              {employeeShiftInfo && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="text-base">Current Shift Assignment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Shift Name</p>
                        <p className="text-lg font-semibold">{employeeShiftInfo.shift_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Shift Timings</p>
                        <p className="text-lg font-semibold">
                          {employeeShiftInfo.start_time.substring(0, 5)} - {employeeShiftInfo.end_time.substring(0, 5)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Monthly Stats */}
              <AttendanceStats 
                userId={selectedEmployeeId} 
                year={employeeDialogMonth.getFullYear()} 
                month={employeeDialogMonth.getMonth() + 1}
                attendanceRecords={attendanceRecords as any}
                holidays={holidays}
                compactView={true}
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

                    // Single source of truth: attendance table only.
                    // Approved leaves are auto-synced into attendance via DB trigger,
                    // so we no longer overlay the leaves table on the calendar.

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

                            const currentDate = new Date(employeeDialogMonth.getFullYear(), employeeDialogMonth.getMonth(), day);
                            const dateStr = format(currentDate, "yyyy-MM-dd");
                            const record = recordMap.get(dateStr);
                            const dayOfWeek = currentDate.getDay();
                            const isSunday = dayOfWeek === 0;
                            
                            // Check if it's a holiday
                            const isHoliday = holidays.some(h => h.date === dateStr);

                            // NOTE: leaves overlay removed — attendance table is the
                            // single source of truth. Approved leaves are auto-synced
                            // into attendance by DB trigger sync_leave_to_attendance.



                            // Determine display info
                            let displayInfo = '';
                            let displayColor = 'bg-muted border-muted-foreground/20 text-muted-foreground';
                            let statusTag = '';

                            // Check if user is present on a holiday
                            const calcStatus = record?.calculated_status?.toLowerCase();
                            // A record is "present" if: it has a check_in_time OR calculated_status is one of the active statuses
                            // AND the record is not rejected AND not marked absent
                            const isActiveRecord = record &&
                              record.status !== 'rejected' &&
                              calcStatus !== 'absent' &&
                              calcStatus !== 'holiday' &&
                              (record.check_in_time != null ||
                                calcStatus === 'present' ||
                                calcStatus === 'late' ||
                                calcStatus === 'half_day' ||
                                calcStatus === 'paid_leave' ||
                                calcStatus === 'leave' ||
                                record.is_half_day ||
                                record.is_late);

                            // Priority 1: If there's an active attendance record, it overrides holiday/Sunday
                            if (isActiveRecord) {
                              if (calcStatus === 'paid_leave') {
                                displayColor = 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700';
                                statusTag = 'PL';
                              } else if (calcStatus === 'leave') {
                                displayColor = 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-700';
                                statusTag = 'LE';
                              } else if (calcStatus === 'half_day' || record!.is_half_day) {
                                displayColor = 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700';
                                statusTag = 'HD';
                              } else if (record!.is_late || calcStatus === 'late') {
                                displayColor = 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700';
                                statusTag = 'LT';
                              } else {
                                displayColor = 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700';
                                statusTag = 'PR';
                              }

                              if (record!.check_in_time) {
                                displayInfo = format(new Date(record!.check_in_time), "hh:mm a");
                              }
                            }
                            // Priority 2: If it's a holiday (including Sunday) with no active attendance
                            else if (isHoliday) {
                              displayColor = 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700';
                              statusTag = 'HO';
                            }
                            // Priority 3: Other attendance records (rejected/absent)
                            else if (record) {
                              if (record.status === 'rejected' || calcStatus === 'absent') {
                                displayColor = 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700';
                                statusTag = 'AB';
                              } else if (calcStatus === 'holiday') {
                                displayColor = 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700';
                                statusTag = 'HO';
                              } else {
                                displayColor = 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700';
                                statusTag = 'PR';
                              }

                              if (record.check_in_time) {
                                displayInfo = format(new Date(record.check_in_time), "hh:mm a");
                              }
                            }
                            // (Leaves overlay removed — attendance is the single source of truth.)

                            // Priority 4: If it's a Sunday (weekend) with no attendance
                            else if (isSunday) {
                              displayColor = 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
                              statusTag = '';
                            }

                            return (
                              <button
                                key={day}
                                className={`aspect-square p-2 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer flex flex-col items-center justify-center text-xs font-medium ${displayColor}`}
                                onClick={() => {
                                  if (record) {
                                    setSelectedAttendance(record as AttendanceWithEmployee);
                                    setApprovalDialogOpen(true);
                                  }
                                }}
                              >
                                <span className="font-bold text-base">{day}</span>
                                {statusTag && (
                                  <>
                                    <span className="font-bold text-lg mt-1">{statusTag}</span>
                                    {record?.is_late && statusTag !== 'LT' && (
                                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 leading-none">LT</span>
                                    )}
                                    {displayInfo && (
                                      <span className="text-xs mt-0.5 opacity-75">{displayInfo}</span>
                                    )}
                                  </>
                                )}
                              </button>
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