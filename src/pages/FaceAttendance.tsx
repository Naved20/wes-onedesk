import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Camera, CheckCircle2, XCircle, Clock, History, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  calculated_status: string | null;
  is_late: boolean;
}

export default function FaceAttendance() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check if authenticated for face attendance
    const isAuthenticated = sessionStorage.getItem("faceAttendanceAuth");
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    fetchCurrentUser();
    fetchAttendanceHistory();
    
    return () => {
      stopCamera();
    };
  }, [navigate]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("employee_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchAttendanceHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const handleCheckIn = async () => {
    if (!cameraActive) {
      toast({
        title: "Camera Not Active",
        description: "Please start the camera first",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const imageData = captureImage();
      if (!imageData) {
        throw new Error("Failed to capture image");
      }

      // TODO: Implement face recognition API call here
      // For now, we'll simulate face recognition
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate face recognition success
      const recognized = true; // This will be replaced with actual face recognition result

      if (!recognized) {
        toast({
          title: "Face Not Recognized",
          description: "Please try again or contact admin",
          variant: "destructive",
        });
        return;
      }

      // Get current user and shift info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const today = format(new Date(), "yyyy-MM-dd");
      
      // Check if already checked in today
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (existingAttendance) {
        toast({
          title: "Already Checked In",
          description: "You have already checked in today",
          variant: "destructive",
        });
        return;
      }

      // Get shift info
      const { data: shiftData } = await supabase.rpc("get_employee_shift", {
        p_user_id: user.id,
        p_date: today,
      });

      if (!shiftData || shiftData.length === 0) {
        toast({
          title: "No Shift Assigned",
          description: "Please contact admin to assign a shift",
          variant: "destructive",
        });
        return;
      }

      const shift = shiftData[0];
      const now = new Date().toISOString();

      // Calculate status
      const { data: statusData } = await supabase.rpc(
        "calculate_attendance_status",
        {
          p_check_in_time: now,
          p_shift_start: shift.start_time,
          p_shift_end: shift.end_time,
          p_late_threshold_minutes: shift.late_threshold_minutes,
          p_half_day_threshold_hours: shift.half_day_threshold_hours,
          p_last_checkin_hours_before_end: shift.last_checkin_hours_before_end,
        }
      );

      const calculatedStatus = statusData || "present";

      // Insert attendance record
      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        date: today,
        check_in_time: now,
        shift_id: shift.shift_id,
        calculated_status: calculatedStatus,
        status: "pending",
        is_late: calculatedStatus === "late",
        notes: "Face recognition check-in",
      });

      if (error) throw error;

      toast({
        title: "Check-In Successful",
        description: `Checked in at ${format(new Date(), "hh:mm a")}`,
      });

      stopCamera();
      fetchAttendanceHistory();
    } catch (error: any) {
      console.error("Error during check-in:", error);
      toast({
        title: "Check-In Failed",
        description: error.message || "Failed to record attendance",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  sessionStorage.removeItem("faceAttendanceAuth");
                  navigate("/auth");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Face Recognition Attendance</h1>
                {currentUser && (
                  <p className="text-sm text-muted-foreground">
                    {currentUser.first_name} {currentUser.last_name}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-base px-4 py-2">
              {format(new Date(), "EEEE, MMM dd, yyyy")}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera Check-In
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Camera is off</p>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-2">
                {!cameraActive ? (
                  <Button onClick={startCamera} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCheckIn}
                      disabled={processing}
                      className="flex-1"
                    >
                      {processing ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Check In
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      disabled={processing}
                    >
                      Stop Camera
                    </Button>
                  </>
                )}
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Instructions:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Position your face in the center of the camera</li>
                  <li>• Ensure good lighting</li>
                  <li>• Remove glasses or masks if possible</li>
                  <li>• Click "Check In" when ready</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Attendance History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {format(new Date(record.date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            {record.check_in_time
                              ? format(new Date(record.check_in_time), "hh:mm a")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  record.calculated_status === "present" || record.calculated_status === "late"
                                    ? "default"
                                    : record.calculated_status === "absent"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {record.calculated_status?.toUpperCase() || "PENDING"}
                              </Badge>
                              {record.is_late && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                  LATE
                                </Badge>
                              )}
                            </div>
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
      </div>
    </div>
  );
}
