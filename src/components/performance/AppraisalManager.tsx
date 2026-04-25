import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Appraisal {
  id: string;
  employee_id: string;
  appraisal_type: "weekly" | "monthly" | "annually";
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  appraisal_period_start: string;
  appraisal_period_end: string;
  notes: string | null;
  employee_profiles: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
}

export function AppraisalManager() {
  const { user, role } = useAuth();
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [appraisalType] = useState<"monthly">("monthly"); // Fixed to monthly for now
  const [employeeProfileId, setEmployeeProfileId] = useState<string | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    console.log("User Role:", role);
    console.log("Is Admin:", isAdmin);
    if (user?.id) {
      fetchEmployeeProfile();
    }
    fetchAppraisals();
  }, [isAdmin, user]);

  const fetchEmployeeProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setEmployeeProfileId(data?.id || null);
    } catch (error: any) {
      console.error("Error fetching employee profile:", error);
    }
  };

  const fetchAppraisals = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("appraisals")
        .select(`
          *,
          employee_profiles (
            first_name,
            last_name,
            employee_id
          )
        `)
        .eq("appraisal_type", "monthly")
        .order("uploaded_at", { ascending: false });

      // If not admin, only show own appraisals
      if (!isAdmin && employeeProfileId) {
        query = query.eq("employee_id", employeeProfileId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppraisals((data || []) as unknown as Appraisal[]);
    } catch (error: any) {
      console.error("Error fetching appraisals:", error);
      toast.error("Failed to load appraisals");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF only)
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are allowed");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !periodStart || !periodEnd) {
      toast.error("Please select a file and specify the appraisal period");
      return;
    }

    // Employee uploads for themselves
    if (!employeeProfileId) {
      toast.error("Employee profile not found");
      return;
    }

    try {
      setUploading(true);

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("appraisals")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create appraisal record
      const { error: insertError } = await supabase.from("appraisals").insert({
        employee_id: employeeProfileId,
        appraisal_type: appraisalType,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        uploaded_by: user?.id,
        appraisal_period_start: periodStart,
        appraisal_period_end: periodEnd,
        notes: notes || null,
      });

      if (insertError) throw insertError;

      toast.success("Appraisal uploaded successfully");
      setSelectedFile(null);
      setPeriodStart("");
      setPeriodEnd("");
      setNotes("");
      fetchAppraisals();
    } catch (error: any) {
      console.error("Error uploading appraisal:", error);
      toast.error("Failed to upload appraisal");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (appraisal: Appraisal) => {
    try {
      const { data, error } = await supabase.storage
        .from("appraisals")
        .download(appraisal.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = appraisal.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download started");
    } catch (error: any) {
      console.error("Error downloading appraisal:", error);
      toast.error("Failed to download appraisal");
    }
  };

  const handleDelete = async (appraisal: Appraisal) => {
    if (!confirm("Are you sure you want to delete this appraisal?")) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("appraisals")
        .remove([appraisal.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("appraisals")
        .delete()
        .eq("id", appraisal.id);

      if (dbError) throw dbError;

      toast.success("Appraisal deleted successfully");
      fetchAppraisals();
    } catch (error: any) {
      console.error("Error deleting appraisal:", error);
      toast.error("Failed to delete appraisal");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-6">


      {/* Download Template Section - Only for Employees */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Appraisal Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-medium">WES Monthly Appraisals.pdf</p>
                  <p className="text-sm text-muted-foreground">
                    Download the monthly appraisal form template
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = "/WES-Monthly-Appraisals.pdf";
                  link.download = "WES-Monthly-Appraisals.pdf";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Download started");
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section - Only for Employees */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Monthly Appraisal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Select PDF File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !periodStart || !periodEnd}
              className="w-full"
            >
              {uploading ? "Uploading..." : "Upload Appraisal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Appraisals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isAdmin ? "All Monthly Appraisals" : "My Monthly Appraisals"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : appraisals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {isAdmin ? "No appraisals uploaded yet" : "You haven't uploaded any appraisals yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>File Name</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    {appraisals.some((a) => a.notes) && <TableHead>Notes</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appraisals.map((appraisal) => (
                    <TableRow key={appraisal.id}>
                      {isAdmin && (
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {appraisal.employee_profiles.first_name} {appraisal.employee_profiles.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {appraisal.employee_profiles.employee_id}
                            </p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          {appraisal.file_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(appraisal.appraisal_period_start), "MMM dd")} -{" "}
                          {format(new Date(appraisal.appraisal_period_end), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFileSize(appraisal.file_size)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(appraisal.uploaded_at), "MMM dd, yyyy")}
                      </TableCell>
                      {appraisals.some((a) => a.notes) && (
                        <TableCell className="text-sm max-w-xs truncate">
                          {appraisal.notes || "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(appraisal)}
                            title="Download PDF"
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            {!isAdmin && "Download"}
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(appraisal)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
  );
}
