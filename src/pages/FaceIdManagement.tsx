import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Camera, Trash2, UserPlus, Loader2, CheckCircle2, X } from "lucide-react";
import { loadFaceModels, getAveragedFaceDescriptor } from "@/lib/faceApi";
import { Database } from "@/integrations/supabase/types";

type Shift = Database["public"]["Tables"]["shifts"]["Row"];

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  institution_assignment?: string | null;
  department?: string | null;
  designation?: string | null;
  enrolled?: boolean;
  enrolled_at?: string;
  photo_url?: string;
  shift_name?: string;
}

// Skeleton Loading Component
function EmployeeSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}

export default function FaceIdManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterInstitution, setFilterInstitution] = useState<string>("all");
  const [filterEnrollment, setFilterEnrollment] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterDesignation, setFilterDesignation] = useState<string>("all");
  const [enrollFor, setEnrollFor] = useState<Employee | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const EMPLOYEES_PER_PAGE = 4;

  useEffect(() => {
    fetchTotalCounts(); // Fetch counts first
    fetchEmployees(true); // Initial load
    fetchShifts();
    loadFaceModels().then(() => setModelsReady(true));
  }, []);

  // Auto-fetch next batch when previous batch is loaded
  useEffect(() => {
    if (!loading && !loadingMore && hasMore && employees.length > 0) {
      const timer = setTimeout(() => {
        fetchEmployees(false);
      }, 300); // Small delay to avoid too many rapid requests
      
      return () => clearTimeout(timer);
    }
  }, [employees.length, loading, loadingMore, hasMore]);

  const fetchTotalCounts = async () => {
    try {
      // Get total employee count
      const { count: totalEmployees } = await supabase
        .from("employee_profiles")
        .select("*", { count: 'exact', head: true })
        .eq("is_active", true);

      // Get enrolled count
      const { count: enrolled } = await supabase
        .from("face_descriptors")
        .select("*", { count: 'exact', head: true })
        .eq("is_active", true);

      setTotalCount(totalEmployees || 0);
      setEnrolledCount(enrolled || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    }
  };

  const fetchEmployees = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const from = currentPage * EMPLOYEES_PER_PAGE;
      const to = from + EMPLOYEES_PER_PAGE - 1;

      const { data: emps, error: empsError, count } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, email, institution_assignment, department, designation", { count: 'exact' })
        .eq("is_active", true)
        .order("first_name")
        .range(from, to);
      
      if (empsError) throw empsError;

      const { data: descs } = await supabase
        .from("face_descriptors")
        .select("user_id, enrolled_at, photo_url, is_active");
      
      // Fetch shifts for employees
      const userIds = emps?.map(e => e.user_id) || [];
      const { data: shiftsData } = await supabase
        .from("employee_shifts")
        .select(`
          user_id,
          shift_id,
          shifts (
            name
          )
        `)
        .in("user_id", userIds)
        .is("effective_to", null);
      
      const enrollMap = new Map(descs?.filter((d) => d.is_active).map((d) => [d.user_id, d]) ?? []);
      const shiftMap = new Map(
        shiftsData?.map(s => [s.user_id, (s.shifts as any)?.name]) || []
      );
      
      const newEmployees = (emps ?? []).map((e) => ({
        ...e,
        enrolled: enrollMap.has(e.user_id),
        enrolled_at: enrollMap.get(e.user_id)?.enrolled_at,
        photo_url: enrollMap.get(e.user_id)?.photo_url ?? undefined,
        shift_name: shiftMap.get(e.user_id),
      }));

      if (reset) {
        setEmployees(newEmployees);
      } else {
        setEmployees(prev => [...prev, ...newEmployees]);
      }
      
      // Check if there are more employees to load
      const totalLoaded = reset ? newEmployees.length : employees.length + newEmployees.length;
      setHasMore(count ? totalLoaded < count : newEmployees.length === EMPLOYEES_PER_PAGE);
      
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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
      const descriptor = await getAveragedFaceDescriptor(videoRef.current, 7, 160);
      if (!descriptor) {
        toast({ title: "No face detected", description: "Please keep the face steady in good light and try again.", variant: "destructive" });
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
      fetchTotalCounts(); // Update counts
      fetchEmployees(true);
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
      fetchTotalCounts(); // Update counts
      fetchEmployees(true);
    }
  };

  const filtered = employees.filter((e) => {
    // Search filter
    const matchesSearch = `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(search.toLowerCase());
    
    // Institution filter
    const matchesInstitution = filterInstitution === "all" || e.institution_assignment === filterInstitution;
    
    // Enrollment filter
    const matchesEnrollment = filterEnrollment === "all" || 
      (filterEnrollment === "enrolled" && e.enrolled) ||
      (filterEnrollment === "not_enrolled" && !e.enrolled);
    
    // Shift filter
    const matchesShift = filterShift === "all" || e.shift_name === filterShift;
    
    // Department filter
    const matchesDepartment = filterDepartment === "all" || e.department === filterDepartment;
    
    // Designation filter
    const matchesDesignation = filterDesignation === "all" || e.designation === filterDesignation;
    
    return matchesSearch && matchesInstitution && matchesEnrollment && 
           matchesShift && matchesDepartment && matchesDesignation;
  });

  // Get unique values for filters
  const uniqueDepartments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  const uniqueDesignations = Array.from(new Set(employees.map(e => e.designation).filter(Boolean)));

  const clearAllFilters = () => {
    setFilterInstitution("all");
    setFilterEnrollment("all");
    setFilterShift("all");
    setFilterDepartment("all");
    setFilterDesignation("all");
  };

  const hasActiveFilters = filterInstitution !== "all" || filterEnrollment !== "all" || 
    filterShift !== "all" || filterDepartment !== "all" || filterDesignation !== "all";

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
            <CardDescription>{enrolledCount} of {totalCount} enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
              
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Institution</Label>
                  <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Institutions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Institutions</SelectItem>
                      <SelectItem value="WES">WES</SelectItem>
                      <SelectItem value="DPS">DPS</SelectItem>
                      <SelectItem value="CLAS">CLAS</SelectItem>
                      <SelectItem value="WESA">WESA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Enrollment Status</Label>
                  <Select value={filterEnrollment} onValueChange={setFilterEnrollment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="enrolled">Enrolled</SelectItem>
                      <SelectItem value="not_enrolled">Not Enrolled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Shift</Label>
                  <Select value={filterShift} onValueChange={setFilterShift}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Shifts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shifts</SelectItem>
                      {shifts.map((shift) => (
                        <SelectItem key={shift.id} value={shift.name}>
                          {shift.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                

                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Designation</Label>
                  <Select value={filterDesignation} onValueChange={setFilterDesignation}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Designations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Designations</SelectItem>
                      {uniqueDesignations.map((desig) => (
                        <SelectItem key={desig} value={desig!}>
                          {desig}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {filterInstitution !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Institution: {filterInstitution}
                      <button
                        onClick={() => setFilterInstitution("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterEnrollment !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Status: {filterEnrollment === "enrolled" ? "Enrolled" : "Not Enrolled"}
                      <button
                        onClick={() => setFilterEnrollment("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterShift !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Shift: {filterShift}
                      <button
                        onClick={() => setFilterShift("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterDepartment !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Department: {filterDepartment}
                      <button
                        onClick={() => setFilterDepartment("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filterDesignation !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Designation: {filterDesignation}
                      <button
                        onClick={() => setFilterDesignation("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 text-xs"
                  >
                    Clear all
                  </Button>
                </div>
              )}
              
              {/* Results Count */}
              <div className="text-sm text-muted-foreground">
                Showing {filtered.length} of {employees.length} employees
              </div>
            </div>
            
            {loading ? (
              <div className="space-y-2 mt-4">
                {[...Array(4)].map((_, index) => (
                  <EmployeeSkeleton key={index} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground mt-4">
                No employees found matching your filters
              </div>
            ) : (
              <div className="space-y-2 mt-4">
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
                      <div className="flex gap-2 mt-1">
                        {emp.institution_assignment && (
                          <Badge variant="outline" className="text-xs">{emp.institution_assignment}</Badge>
                        )}
                        {emp.shift_name && (
                          <Badge variant="outline" className="text-xs">{emp.shift_name}</Badge>
                        )}
                        {emp.designation && (
                          <Badge variant="outline" className="text-xs">{emp.designation}</Badge>
                        )}
                      </div>
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
            )}
            
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="space-y-2 mt-4">
                {[...Array(2)].map((_, index) => (
                  <EmployeeSkeleton key={`loading-${index}`} />
                ))}
              </div>
            )}

            {/* No more employees indicator */}
            {!loading && !loadingMore && !hasMore && employees.length > 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>No more employees to load</p>
              </div>
            )}
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
