import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAttendanceStatusBadge } from "@/lib/attendanceUtils";
import { attendanceNotifications } from "@/lib/notificationService";

interface AttendanceCheckInProps {
  userId: string;
  todayCheckedIn: boolean;
  onCheckInComplete: () => void;
}

interface TodayAttendance {
  status: string | null;
  calculated_status: string | null;
  is_late: boolean | null;
  check_in_time: string | null;
  check_out_time: string | null;
  is_half_day: boolean | null;
  half_day_type: string | null;
}

interface ShiftInfo {
  shift_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  half_day_threshold_hours: number;
  last_checkin_hours_before_end: number;
}

export function AttendanceCheckIn({ userId, todayCheckedIn, onCheckInComplete }: AttendanceCheckInProps) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<{
    status: string;
    message: string;
    variant: "default" | "destructive" | "secondary";
  }>({ status: "loading", message: "Loading shift info...", variant: "secondary" });

  useEffect(() => {
    fetchShiftInfo();
    if (todayCheckedIn) {
      fetchTodayAttendance();
    }
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [userId, todayCheckedIn]);

  useEffect(() => {
    if (shiftInfo) {
      calculateAttendanceStatus();
    }
  }, [currentTime, shiftInfo]);

  const fetchTodayAttendance = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("attendance")
        .select("status, calculated_status, is_late, check_in_time, check_out_time, is_half_day, half_day_type")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
    }
  };

  const fetchShiftInfo = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.rpc("get_employee_shift", {
        p_user_id: userId,
        p_date: today,
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setShiftInfo(data[0]);
      } else {
        setAttendanceStatus({
          status: "no_shift",
          message: "No shift assigned. Contact admin.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching shift:", error);
      toast({
        title: "Error",
        description: "Failed to load shift information",
        variant: "destructive",
      });
    }
  };

  const calculateAttendanceStatus = () => {
    if (!shiftInfo) return;

    // Get current time in IST (Asia/Kolkata timezone)
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const [startHour, startMin] = shiftInfo.start_time.split(":").map(Number);
    const [endHour, endMin] = shiftInfo.end_time.split(":").map(Number);

    // Create shift times in IST
    const shiftStart = new Date(istTime);
    shiftStart.setHours(startHour, startMin, 0, 0);

    const shiftEnd = new Date(istTime);
    shiftEnd.setHours(endHour, endMin, 0, 0);
    if (endHour < startHour) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const lateThreshold = new Date(shiftStart.getTime() + shiftInfo.late_threshold_minutes * 60000);
    const halfDayThreshold = new Date(shiftStart.getTime() + shiftInfo.half_day_threshold_hours * 3600000);
    const lastCheckinLimit = new Date(shiftEnd.getTime() - shiftInfo.last_checkin_hours_before_end * 3600000);

    if (istTime >= lastCheckinLimit) {
      setAttendanceStatus({
        status: "absent",
        message: "Too late to check-in. Will be marked Absent.",
        variant: "destructive",
      });
    } else if (istTime >= halfDayThreshold) {
      setAttendanceStatus({
        status: "half_day",
        message: "Check-in will be marked as Half Day.",
        variant: "destructive",
      });
    } else if (istTime > lateThreshold) {
      setAttendanceStatus({
        status: "late",
        message: "You are late. Check-in will be flagged.",
        variant: "destructive",
      });
    } else {
      setAttendanceStatus({
        status: "on_time",
        message: "You are on time!",
        variant: "default",
      });
    }
  };

  const handleCheckIn = async () => {
    if (!userId || !shiftInfo) return;
    if (isHalfDay && !halfDayType) {
      toast({
        title: "Select Half Day Type",
        description: "Please select First Half or Second Half",
        variant: "destructive",
      });
      return;
    }

    if (attendanceStatus.status === "absent") {
      toast({
        title: "Cannot Check-In",
        description: "Too late to check-in for today",
        variant: "destructive",
      });
      return;
    }

    setCheckingIn(true);
    try {
      // Get current time in IST
      const now = new Date();
      const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Format date in IST
      const today = format(istTime, "yyyy-MM-dd");
      
      // Store timestamp in UTC (database will handle conversion)
      const nowUTC = now.toISOString();

      // Calculate status using database function (it will convert UTC to IST internally)
      const { data: statusData, error: statusError } = await supabase.rpc(
        "calculate_attendance_status",
        {
          p_check_in_time: nowUTC,
          p_shift_start: shiftInfo.start_time,
          p_shift_end: shiftInfo.end_time,
          p_late_threshold_minutes: shiftInfo.late_threshold_minutes,
          p_half_day_threshold_hours: shiftInfo.half_day_threshold_hours,
          p_last_checkin_hours_before_end: shiftInfo.last_checkin_hours_before_end,
        }
      );

      if (statusError) throw statusError;

      const calculatedStatus = statusData || attendanceStatus.status;

      const { error } = await supabase.from("attendance").insert({
        user_id: userId,
        date: today,
        check_in_time: nowUTC,
        shift_id: shiftInfo.shift_id,
        calculated_status: calculatedStatus,
        status: "pending",
        is_half_day: isHalfDay,
        half_day_type: isHalfDay ? halfDayType : null,
        notes: notes || null,
        is_late: calculatedStatus === "late",
      });

      if (error) throw error;

      // Trigger notification for attendance check-in
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();

      const empName = profile ? `${profile.first_name} ${profile.last_name}` : "Employee";
      await attendanceNotifications.checkIn(
        userId,
        empName,
        format(istTime, "hh:mm a")
      );

      const statusMessages = {
        present: "Checked in successfully!",
        late: "Late check-in recorded and flagged for review.",
        half_day: "Half day attendance recorded.",
        absent: "Marked as absent due to late check-in.",
      };

      toast({
        title: calculatedStatus === "present" ? "Success" : "Check-In Recorded",
        description: statusMessages[calculatedStatus as keyof typeof statusMessages] || "Attendance recorded.",
        variant: calculatedStatus === "present" ? "default" : "destructive",
      });

      onCheckInComplete();
    } catch (error) {
      console.error("Error checking in:", error);
      toast({
        title: "Error",
        description: "Failed to record attendance",
        variant: "destructive",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!userId) return;

    setCheckingOut(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_time: now,
        })
        .eq("user_id", userId)
        .eq("date", today);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Checked out successfully!",
      });

      fetchTodayAttendance();
    } catch (error) {
      console.error("Error checking out:", error);
      toast({
        title: "Error",
        description: "Failed to record check-out",
        variant: "destructive",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  if (todayCheckedIn && todayAttendance) {
    const displayStatus = todayAttendance.calculated_status || "present";
    const statusBadge = getAttendanceStatusBadge(displayStatus, false);

    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 dark:text-green-200">Already Checked In Today</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {format(new Date(), "EEEE, MMMM do, yyyy")}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div>
              <p className="text-sm text-muted-foreground">Check-in Time</p>
              <p className="font-semibold">
                {todayAttendance.check_in_time 
                  ? format(new Date(todayAttendance.check_in_time), "hh:mm a")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-out Time</p>
              <p className="font-semibold">
                {todayAttendance.check_out_time 
                  ? format(new Date(todayAttendance.check_out_time), "hh:mm a")
                  : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex gap-1 items-center mt-1">
                <Badge variant={statusBadge.variant} className="font-mono">
                  {statusBadge.label}
                </Badge>
                {todayAttendance.is_late && (
                  <Badge variant="outline" className="font-mono bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                    LT
                  </Badge>
                )}
              </div>
            </div>
            {!todayAttendance.check_out_time && (
              <Button
                onClick={handleCheckOut}
                disabled={checkingOut}
                size="sm"
                variant="outline"
              >
                {checkingOut ? "Checking Out..." : "Check Out"}
              </Button>
            )}
          </div>

          {todayAttendance.is_half_day && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">
                {todayAttendance.half_day_type === "first_half" ? "First Half" : "Second Half"}
              </Badge>
            </div>
          )}

          {todayAttendance.status === "pending" && (
            <p className="text-xs text-muted-foreground text-center">
              Pending manager approval
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily Check-In
          </div>
          <Badge variant={attendanceStatus.variant}>
            {attendanceStatus.status === "on_time" && "On Time"}
            {attendanceStatus.status === "late" && "Late"}
            {attendanceStatus.status === "half_day" && "Half Day"}
            {attendanceStatus.status === "absent" && "Too Late"}
            {attendanceStatus.status === "no_shift" && "No Shift"}
            {attendanceStatus.status === "loading" && "Loading..."}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Info */}
        {shiftInfo && (
          <div className="p-3 rounded-lg bg-muted space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your Shift</p>
                <p className="font-semibold">{shiftInfo.shift_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Timings</p>
                <p className="font-medium">
                  {shiftInfo.start_time.substring(0, 5)} - {shiftInfo.end_time.substring(0, 5)}
                </p>
              </div>
            </div>
            <div className="text-center pt-2 border-t">
              <p className="text-sm text-muted-foreground">Current Time</p>
              <p className="text-2xl font-bold font-mono">{format(currentTime, "hh:mm:ss a")}</p>
            </div>
          </div>
        )}

        {/* Status Message */}
        {attendanceStatus.status !== "loading" && attendanceStatus.status !== "on_time" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{attendanceStatus.message}</p>
            </div>
          </div>
        )}

        {attendanceStatus.status === "on_time" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-800 dark:text-green-200">{attendanceStatus.message}</p>
          </div>
        )}

        {/* Half Day Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="half-day" className="cursor-pointer">
            Half Day Attendance
          </Label>
          <Switch
            id="half-day"
            checked={isHalfDay}
            onCheckedChange={setIsHalfDay}
          />
        </div>

        {/* Half Day Type Selection */}
        {isHalfDay && (
          <div className="space-y-2">
            <Label>Half Day Type</Label>
            <Select value={halfDayType} onValueChange={setHalfDayType}>
              <SelectTrigger>
                <SelectValue placeholder="Select half day type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_half">First Half (Morning)</SelectItem>
                <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        {(attendanceStatus.status === "late" || attendanceStatus.status === "half_day" || notes) && (
          <div className="space-y-2">
            <Label htmlFor="notes">
              {attendanceStatus.status === "late" || attendanceStatus.status === "half_day" 
                ? "Reason (Required)" 
                : "Notes (Optional)"}
            </Label>
            <Textarea
              id="notes"
              placeholder="Please provide a reason..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Check-In Button */}
        <Button
          onClick={handleCheckIn}
          disabled={
            checkingIn ||
            !shiftInfo ||
            attendanceStatus.status === "absent" ||
            attendanceStatus.status === "no_shift" ||
            ((attendanceStatus.status === "late" || attendanceStatus.status === "half_day") && !notes)
          }
          className="w-full"
          size="lg"
        >
          <Clock className="h-4 w-4 mr-2" />
          {checkingIn ? "Checking In..." : isHalfDay ? "Check In (Half Day)" : "Check In"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {format(new Date(), "EEEE, MMMM do, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}
