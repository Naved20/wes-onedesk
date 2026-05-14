import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Camera, LogOut, History, CheckCircle2, XCircle, Loader2, Scan } from "lucide-react";
import { loadFaceModels, getAveragedFaceDescriptor } from "@/lib/faceApi";
import { format } from "date-fns";
import wesLogo from "@/assets/wes-logo.jpg";
import { updateSessionActivity, logoutFaceSession, isSessionValid } from "@/lib/faceSessionManager";

interface HistoryRow {
  id: string;
  user_id: string | null;
  matched: boolean;
  match_distance: number | null;
  notes: string | null;
  created_at: string;
  employee_name?: string;
}

export default function FaceHub() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showNotEnrolledDialog, setShowNotEnrolledDialog] = useState(false);
  const [notEnrolledDistance, setNotEnrolledDistance] = useState<number | null>(null);
  const [checkInData, setCheckInData] = useState<{ 
    name: string; 
    time: string; 
    shiftName?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
  } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (localStorage.getItem("faceAttendanceAuth") !== "true") {
        navigate("/auth");
        return;
      }

      // Only check session validity if it exists and was created more than 5 seconds ago
      const sessionToken = localStorage.getItem("faceSessionToken");
      const sessionCreatedAt = localStorage.getItem("faceSessionCreatedAt");
      
      if (sessionToken && sessionCreatedAt) {
        const createdTime = parseInt(sessionCreatedAt);
        const now = Date.now();
        
        // Only validate if session is older than 5 seconds (skip validation right after login)
        if (now - createdTime > 5000) {
          const valid = await isSessionValid(sessionToken);
          if (!valid) {
            localStorage.removeItem("faceAttendanceAuth");
            localStorage.removeItem("faceSessionToken");
            localStorage.removeItem("faceSessionCreatedAt");
            toast({
              title: "Session Expired",
              description: "Your session has been logged out by admin",
              variant: "destructive",
            });
            navigate("/auth");
            return;
          }
        }
      }
    };

    checkAuth();
    initCamera();
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((e) => toast({ title: "Model load failed", description: String(e), variant: "destructive" }));
    fetchHistory();

    // Update activity every 30 seconds
    const activityInterval = setInterval(() => {
      const sessionToken = localStorage.getItem("faceSessionToken");
      if (sessionToken) {
        updateSessionActivity(sessionToken);
      }
    }, 30000);

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(activityInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 1280, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast({ title: "Camera error", description: "Cannot access camera", variant: "destructive" });
    }
  };

  const playSuccessSound = () => {
    // Create a simple success beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase.functions.invoke("face-hub-checkin", {
      body: { action: "history" },
    });

    if (error || !data?.ok) {
      console.error("Face history load failed:", error ?? data?.message);
      return;
    }

    setHistory(data.history ?? []);
  };

  const handleScan = async () => {
    if (!videoRef.current || !modelsReady) return;
    const v = videoRef.current;
    if (!v.videoWidth || !v.videoHeight || v.readyState < 2) {
      setLastResult({ ok: false, msg: "Camera not ready. Please wait a moment and try again." });
      return;
    }
    setScanning(true);
    setLastResult(null);
    try {
      // Average multiple frames so one blink/movement/lighting change does not break matching
      const descriptor = await getAveragedFaceDescriptor(v, 7, 160);
      if (!descriptor) {
        setLastResult({ ok: false, msg: "No face detected. Please face the camera squarely with good lighting." });
        
        // Show not enrolled popup for no face detected
        setShowNotEnrolledDialog(true);
        setTimeout(() => {
          setShowNotEnrolledDialog(false);
        }, 4000);
        
        await supabase.from("face_checkin_history").insert({
          user_id: null,
          matched: false,
          notes: "No face detected",
        });
        fetchHistory();
        return;
      }

      const { data, error } = await supabase.functions.invoke("face-hub-checkin", {
        body: { descriptor: Array.from(descriptor) },
      });

      if (error || !data) {
        setLastResult({ ok: false, msg: error?.message ?? "Face check-in failed." });
        return;
      }

      // CRITICAL: Frontend validation - reject if distance > 0.40
      const distance = typeof data.distance === "number" ? data.distance : null;
      if (distance !== null && distance > 0.40) {
        setLastResult({ 
          ok: false, 
          msg: `Face not recognized. Match quality too low (${distance.toFixed(3)}). Please ensure you are enrolled.` 
        });
        setLastDistance(distance);
        setNotEnrolledDistance(distance);
        
        // Show not enrolled popup
        setShowNotEnrolledDialog(true);
        
        // Auto-close after 4 seconds
        setTimeout(() => {
          setShowNotEnrolledDialog(false);
          setNotEnrolledDistance(null);
        }, 4000);
        
        // Log failed attempt
        await supabase.from("face_checkin_history").insert({
          user_id: null,
          matched: false,
          match_distance: distance,
          notes: "Rejected by frontend - distance above threshold",
        });
        
        fetchHistory();
        return;
      }

      setLastDistance(distance);
      setLastResult({ ok: Boolean(data.ok), msg: data.message ?? "Face check-in failed." });
      
      // If successful, play sound and show popup
      if (data.ok) {
        playSuccessSound();
        setCheckInData({
          name: data.employeeName || "Employee",
          time: format(new Date(), "hh:mm a"),
          shiftName: data.shiftName,
          shiftStartTime: data.shiftStartTime,
          shiftEndTime: data.shiftEndTime,
        });
        setShowSuccessDialog(true);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowSuccessDialog(false);
          setCheckInData(null);
        }, 3000);
      }
      
      fetchHistory();
    } catch (e: any) {
      setLastResult({ ok: false, msg: e.message ?? "Scan failed" });
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = async () => {
    const sessionToken = localStorage.getItem("faceSessionToken");
    if (sessionToken) {
      await logoutFaceSession(sessionToken, "User logout");
    }
    localStorage.removeItem("faceAttendanceAuth");
    localStorage.removeItem("faceSessionToken");
    localStorage.removeItem("faceSessionCreatedAt");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img src={wesLogo} alt="WES" className="h-12 w-12 rounded-full object-cover" />
            <div>
              <h1 className="text-2xl font-bold">Face Attendance Hub</h1>
              <p className="text-sm text-muted-foreground">Look at the camera and scan</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>

        <Tabs defaultValue="checkin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checkin">
              <Camera className="h-4 w-4 mr-2" /> Check-in
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkin" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>Camera</CardTitle>
                <CardDescription>
                  {modelsReady ? "Models loaded. Position your face and tap Scan." : "Loading face models..."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-black aspect-[9/8] border-4 border-primary/30 shadow-2xl">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {scanning && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center space-y-4">
                        <Scan className="h-20 w-20 mx-auto text-white animate-pulse drop-shadow-lg" />
                        <p className="text-white text-xl font-semibold drop-shadow-lg">Scanning face...</p>
                      </div>
                    </div>
                  )}
                </div>
                {lastResult && (
                  <div
                    className={`p-4 rounded-lg flex items-center gap-3 ${
                      lastResult.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {lastResult.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    <span className="font-medium">
                      {lastResult.msg}
                      {lastDistance !== null ? ` Match score: ${lastDistance.toFixed(3)}` : ""}
                    </span>
                  </div>
                )}
                <Button onClick={handleScan} disabled={!modelsReady || scanning} size="lg" className="w-full h-14 text-lg">
                  {scanning ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Scanning...
                    </>
                  ) : (
                    <>
                      <Camera className="h-6 w-6 mr-2" /> Scan Face & Check-in
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Check-ins</CardTitle>
                <CardDescription>Last 50 face attendance attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No history yet</p>
                  )}
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-3 rounded border">
                      <div>
                        <p className="font-medium">{h.employee_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                          {h.notes ? ` · ${h.notes}` : ""}
                        </p>
                      </div>
                      <Badge variant={h.matched ? "default" : "destructive"}>
                        {h.matched ? "Matched" : "Failed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center space-y-4 py-6">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-green-600">Check-In Successful!</h3>
              {checkInData && (
                <>
                  <p className="text-lg font-semibold">{checkInData.name}</p>
                  <p className="text-muted-foreground">
                    Checked in at <span className="font-semibold">{checkInData.time}</span>
                  </p>
                  {checkInData.shiftName && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900">
                        Shift: {checkInData.shiftName}
                      </p>
                      {checkInData.shiftStartTime && checkInData.shiftEndTime && (
                        <p className="text-xs text-blue-700 mt-1">
                          {checkInData.shiftStartTime} - {checkInData.shiftEndTime}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="success-progress-bar h-full bg-green-600 rounded-full"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Not Enrolled Dialog */}
      <Dialog open={showNotEnrolledDialog} onOpenChange={setShowNotEnrolledDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center space-y-4 py-6">
            <div className="rounded-full bg-red-100 p-3">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-red-600">Not Enrolled!</h3>
              <p className="text-base text-muted-foreground px-4">
                Your face is not registered in the system.
              </p>
              {notEnrolledDistance !== null && (
                <p className="text-sm text-muted-foreground">
                  Match score: <span className="font-mono font-semibold">{notEnrolledDistance.toFixed(3)}</span>
                </p>
              )}
              <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-medium text-orange-900 mb-2">
                  Please contact your administrator to:
                </p>
                <ul className="text-xs text-orange-800 text-left space-y-1">
                  <li>• Register your face in the system</li>
                  <li>• Verify your enrollment status</li>
                  <li>• Get access to face attendance</li>
                </ul>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="error-progress-bar h-full bg-red-600 rounded-full"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
