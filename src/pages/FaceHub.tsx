import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Camera, LogOut, History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { loadFaceModels, getAveragedFaceDescriptor } from "@/lib/faceApi";
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

      setLastDistance(typeof data.distance === "number" ? data.distance : null);
      setLastResult({ ok: Boolean(data.ok), msg: data.message ?? "Face check-in failed." });
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
