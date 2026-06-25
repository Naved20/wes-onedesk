import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";

interface UploadProgressProps {
  fileName?: string;
  percentage: number;
  uploading: boolean;
  error: string | null;
  loaded?: number;
  total?: number;
  showFileName?: boolean;
  showSize?: boolean;
}

export function UploadProgress({
  fileName = "File",
  percentage,
  uploading,
  error,
  loaded = 0,
  total = 0,
  showFileName = true,
  showSize = true,
}: UploadProgressProps) {
  // Ensure percentage is between 0 and 100
  const normalizedPercentage = Math.min(Math.max(Math.round(percentage), 0), 100);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              {showFileName && (
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  {fileName}
                </p>
              )}
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Upload failed: {error}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (normalizedPercentage === 100 && !uploading) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              {showFileName && (
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {fileName}
                </p>
              )}
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                Upload complete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-3">
          {uploading && (
            <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-pulse" />
          )}
          <div className="flex-1 min-w-0">
            {showFileName && (
              <p className="text-sm font-medium truncate">{fileName}</p>
            )}
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {uploading ? "Uploading..." : "Upload complete"}
              </p>
              <span className="text-xs font-medium text-primary">{normalizedPercentage}%</span>
            </div>
          </div>
        </div>

        <Progress value={normalizedPercentage} className="h-2" />

        {showSize && total > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {formatBytes(loaded)} / {formatBytes(total)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
