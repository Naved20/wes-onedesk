import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UploadReportDialogProps {
  onSuccess?: () => void;
  onUpload?: (reportData: any) => Promise<void>;
}

export function UploadReportDialog({ onSuccess, onUpload }: UploadReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    report_date: "",
    file: null as File | null,
  });

  // Auto-fetch employee name from profile
  const getEmployeeName = () => {
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "Employee";
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setReportData(prev => ({ ...prev, file }));
      toast({
        title: "File Selected",
        description: `${file.name} ready for upload`,
      });
    }
  };

  const uploadToGoogleDrive = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userName", getEmployeeName());
      formData.append("reportDate", reportData.report_date);

      const { data, error } = await supabase.functions.invoke("upload-to-drive", {
        body: formData,
      });

      if (error) throw error;
      if (!data?.webViewLink) throw new Error("No file link returned");

      return data.webViewLink;
    } catch (error) {
      console.error("Google Drive upload failed:", error);
      throw new Error("Failed to upload file to Google Drive");
    }
  };

  const handleUpload = async () => {
    if (!reportData.report_date || !reportData.file) {
      toast({
        title: "Validation Error",
        description: "Please select date and file",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Upload file to Google Drive
      toast({
        title: "Uploading",
        description: "Uploading file to Google Drive...",
      });
      
      const googleDriveLink = await uploadToGoogleDrive(reportData.file);

      // Save data to database with employee_name
      const uploadPayload = {
        report_date: reportData.report_date,
        file_url: googleDriveLink,
        employee_name: getEmployeeName(), // IMPORTANT: Pass employee_name here
      };

      if (onUpload) {
        await onUpload(uploadPayload);
      }

      toast({
        title: "Success",
        description: "Report uploaded successfully",
      });

      setOpen(false);
      setReportData({
        report_date: "",
        file: null,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Upload className="mr-2 h-4 w-4" />
          Upload Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload Weekly Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Name - Display Only (Auto-fetched) */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Employee Name</Label>
            <div className="mt-2 p-3 bg-muted rounded-lg border border-muted-foreground/20">
              <p className="text-sm font-semibold">{getEmployeeName()}</p>
            </div>
          </div>

          {/* Report Date */}
          <div>
            <Label htmlFor="report_date" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Report Date *
            </Label>
            <Input
              id="report_date"
              type="date"
              value={reportData.report_date}
              onChange={(e) =>
                setReportData(prev => ({ ...prev, report_date: e.target.value }))
              }
              className="mt-2"
            />
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="file_upload" className="text-sm font-medium">
              Upload File *
            </Label>
            <Input
              id="file_upload"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
              onChange={handleFileSelect}
              disabled={loading}
              className="mt-2"
            />
            {reportData.file && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                ✓ {reportData.file.name}
              </p>
            )}
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={loading}
            className="w-full mt-6"
            size="lg"
          >
            {loading ? "Uploading..." : "Upload Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
