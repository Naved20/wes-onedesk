import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Camera, LogOut, History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { loadFaceModels, getAveragedFaceDescriptor, findBestMatch, MATCH_THRESHOLD } from "@/lib/faceApi";
import wesLogo from "@/assets/wes-logo.jpg";

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

  useEffect(() => {
    if (sessionStorage.getItem("faceAttendanceAuth") !== "true") {
      navigate("/auth");
      return;
    }
    initCamera();
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((e) => toast({ title: "Model load failed", description: String(e), variant: "destructive" }));
    fetchHistory();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      toast({ title: "Camera error", description: "Cannot access camera", variant: "destructive" });
    }
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("face_checkin_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    const userIds = Array.from(new Set(data.map((r) => r.user_id).filter(Boolean))) as string[];
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      profiles?.forEach((p) => nameMap.set(p.user_id, `${p.first_name} ${p.last_name}`));
    }
    setHistory(data.map((r) => ({ ...r, employee_name: r.user_id ? nameMap.get(r.user_id) : undefined })));
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
        await supabase.from("face_checkin_history").insert({
          user_id: null,
          matched: false,
          notes: "No face detected",
        });
        fetchHistory();
        return;
      }

      const { data: enrolled, error: enrollErr } = await supabase
        .from("face_descriptors")
        .select("user_id, descriptor")
        .eq("is_active", true);

      if (enrollErr) {
        setLastResult({ ok: false, msg: `DB error: ${enrollErr.message}` });
        return;
      }
      if (!enrolled || enrolled.length === 0) {
        setLastResult({ ok: false, msg: "No enrolled faces in system." });
        return;
      }

      const candidates = enrolled.map((e) => ({
        user_id: e.user_id,
        descriptor: e.descriptor as unknown as number[],
      }));
      console.log(`[FaceHub] Comparing against ${candidates.length} enrolled faces`);
      const match = findBestMatch(descriptor, candidates);
      console.log(`[FaceHub] Best match distance: ${match?.distance.toFixed(4)} (threshold: ${MATCH_THRESHOLD})`);
      setLastDistance(match?.distance ?? null);

      if (!match || match.distance > MATCH_THRESHOLD) {
        setLastResult({
          ok: false,
          msg: `Face not recognized (distance: ${match?.distance.toFixed(3) ?? "n/a"})`,
        });
        await supabase.from("face_checkin_history").insert({
          user_id: null,
          matched: false,
          match_distance: match?.distance ?? null,
          notes: "No match above threshold",
        });
        fetchHistory();
        return;
      }

      // Get profile for greeting
      const { data: profile } = await supabase
        .from("employee_profiles")
        .select("first_name, last_name")
        .eq("user_id", match.user_id)
        .maybeSingle();
      const empName = profile ? `${profile.first_name} ${profile.last_name}` : "Employee";

      // Get today's shift
      const today = new Date().toISOString().slice(0, 10);
      const { data: shiftRows } = await supabase.rpc("get_employee_shift", {
        p_user_id: match.user_id,
        p_date: today,
      });
      const shiftId = shiftRows?.[0]?.shift_id ?? null;

      // Check existing attendance for today
      const { data: existing } = await supabase
        .from("attendance")
        .select("id, check_in_time")
        .eq("user_id", match.user_id)
        .eq("date", today)
        .maybeSingle();

      let attendanceId: string | null = null;
      if (existing?.check_in_time) {
        setLastResult({ ok: true, msg: `${empName} already checked in today.` });
        attendanceId = existing.id;
      } else if (existing) {
        const { data: upd } = await supabase
          .from("attendance")
          .update({
            check_in_time: new Date().toISOString(),
            status: "approved",
            shift_id: shiftId,
            notes: "Face recognition check-in",
          })
          .eq("id", existing.id)
          .select("id")
          .single();
        attendanceId = upd?.id ?? null;
        setLastResult({ ok: true, msg: `Welcome, ${empName}! Check-in recorded.` });
      } else {
        const { data: ins } = await supabase
          .from("attendance")
          .insert({
            user_id: match.user_id,
            date: today,
            check_in_time: new Date().toISOString(),
            status: "approved",
            shift_id: shiftId,
            notes: "Face recognition check-in",
          })
          .select("id")
          .single();
        attendanceId = ins?.id ?? null;
        setLastResult({ ok: true, msg: `Welcome, ${empName}! Check-in recorded.` });
      }

      await supabase.from("face_checkin_history").insert({
        user_id: match.user_id,
        matched: true,
        match_distance: match.distance,
        attendance_id: attendanceId,
        notes: `Matched ${empName}`,
      });
      fetchHistory();
    } catch (e: any) {
      setLastResult({ ok: false, msg: e.message ?? "Scan failed" });
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("faceAttendanceAuth");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="checkin">
              <Camera className="h-4 w-4 mr-2" /> Check-in
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkin" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Camera</CardTitle>
                <CardDescription>
                  {modelsReady ? "Models loaded. Position your face and tap Scan." : "Loading face models..."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden bg-black aspect-video">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
                <Button onClick={handleScan} disabled={!modelsReady || scanning} size="lg" className="w-full">
                  {scanning ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Scanning...
                    </>
                  ) : (
                    <>
                      <Camera className="h-5 w-5 mr-2" /> Scan Face & Check-in
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
    </div>
  );
}
