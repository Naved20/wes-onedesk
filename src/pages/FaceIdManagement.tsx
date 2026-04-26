import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Camera, Trash2, UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { loadFaceModels, getFaceDescriptor } from "@/lib/faceApi";

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  enrolled?: boolean;
  enrolled_at?: string;
  photo_url?: string;
}

export default function FaceIdManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [enrollFor, setEnrollFor] = useState<Employee | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    fetchEmployees();
    loadFaceModels().then(() => setModelsReady(true));
  }, []);

  const fetchEmployees = async () => {
    const { data: emps } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name, email")
      .eq("is_active", true)
      .order("first_name");
    const { data: descs } = await supabase
      .from("face_descriptors")
      .select("user_id, enrolled_at, photo_url, is_active");
    const enrollMap = new Map(descs?.filter((d) => d.is_active).map((d) => [d.user_id, d]) ?? []);
    setEmployees(
      (emps ?? []).map((e) => ({
        ...e,
        enrolled: enrollMap.has(e.user_id),
        enrolled_at: enrollMap.get(e.user_id)?.enrolled_at,
        photo_url: enrollMap.get(e.user_id)?.photo_url ?? undefined,
      }))
    );
  };

  const startEnroll = async (emp: Employee) => {
    setEnrollFor(emp);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast({ title: "Camera error", variant: "destructive" });
      }
    }, 100);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const closeDialog = () => {
    stopCamera();
    setEnrollFor(null);
  };

  const captureAndSave = async () => {
    if (!videoRef.current || !enrollFor) return;
    setCapturing(true);
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        toast({ title: "No face detected", variant: "destructive" });
        return;
      }

      // Capture photo to upload
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));

      let photoUrl: string | null = null;
      if (blob) {
        const path = `${enrollFor.user_id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("face-enrollments").upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (!upErr) {
          photoUrl = supabase.storage.from("face-enrollments").getPublicUrl(path).data.publicUrl;
        }
      }

      const descArr = Array.from(descriptor);
      const { error } = await supabase.from("face_descriptors").upsert(
        {
          user_id: enrollFor.user_id,
          descriptor: descArr as any,
          photo_url: photoUrl,
          is_active: true,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;

      toast({ title: "Enrolled", description: `${enrollFor.first_name} ${enrollFor.last_name} face saved.` });
      closeDialog();
      fetchEmployees();
    } catch (e: any) {
      toast({ title: "Enrollment failed", description: e.message, variant: "destructive" });
    } finally {
      setCapturing(false);
    }
  };

  const removeEnrollment = async (userId: string) => {
    if (!confirm("Remove face enrollment?")) return;
    const { error } = await supabase.from("face_descriptors").delete().eq("user_id", userId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Removed" });
      fetchEmployees();
    }
  };

  const filtered = employees.filter((e) =>
    `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Face ID Management</h1>
          <p className="text-muted-foreground">Enroll employees for face-based attendance check-in</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>{employees.filter((e) => e.enrolled).length} of {employees.length} enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md mb-4"
            />
            <div className="space-y-2">
              {filtered.map((emp) => (
                <div key={emp.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {emp.first_name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.enrolled ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Enrolled
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not enrolled</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startEnroll(emp)}>
                      <UserPlus className="h-4 w-4 mr-1" /> {emp.enrolled ? "Re-enroll" : "Enroll"}
                    </Button>
                    {emp.enrolled && (
                      <Button size="sm" variant="ghost" onClick={() => removeEnrollment(emp.user_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!enrollFor} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enroll: {enrollFor?.first_name} {enrollFor?.last_name}</DialogTitle>
            <DialogDescription>
              Position the employee's face in the camera and capture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <Button
              onClick={captureAndSave}
              disabled={!modelsReady || capturing}
              className="w-full"
              size="lg"
            >
              {capturing ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Camera className="h-5 w-5 mr-2" /> Capture & Save</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
