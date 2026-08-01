import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Upload, Zap } from "lucide-react";

interface UploadProgressProps {
  fileName?: string;
  percentage: number;
  uploading: boolean;
  error: string | null;
  loaded?: number;
  total?: number;
  showFileName?: boolean;
  showSize?: boolean;
  phase?: 'compression' | 'preparation' | 'upload' | 'complete';
  phaseDetails?: string;
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
  phase = 'compression',
  phaseDetails = '',
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

  const getPhaseInfo = () => {
    switch (phase) {
      case 'compression':
        return {
          label: '🔄 Compressing',
          description: 'Processing file...',
          progressColor: 'bg-blue-500',
          rangeText: '0% - 35%'
        };
      case 'preparation':
        return {
          label: '⚙️ Preparing',
          description: 'Getting ready to upload...',
          progressColor: 'bg-purple-500',
          rangeText: '35% - 50%'
        };
      case 'upload':
        return {
          label: '📤 Uploading',
          description: 'Sending to Google Drive...',
          progressColor: 'bg-orange-500',
          rangeText: '50% - 95%'
        };
      case 'complete':
        return {
          label: '✅ Complete',
          description: 'Successfully uploaded!',
          progressColor: 'bg-green-500',
          rangeText: '100%'
        };
      default:
        return {
          label: '📤 Uploading',
          description: 'Processing...',
          progressColor: 'bg-blue-500',
          rangeText: `${normalizedPercentage}%`
        };
    }
  };

  const phaseInfo = getPhaseInfo();

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
                ❌ Upload failed: {error}
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
                ✅ Upload complete - Saved to Google Drive!
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
        {/* Phase Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span className="text-sm font-semibold">{phaseInfo.label}</span>
          </div>
          <span className="text-sm font-bold text-primary">{normalizedPercentage}%</span>
        </div>

        {/* Phase Description */}
        <div className="flex items-center gap-3">
          {showFileName && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {phaseInfo.description}
              </p>
              {phaseDetails && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {phaseDetails}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={normalizedPercentage} className="h-3" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{phaseInfo.rangeText}</span>
            <span className="font-medium">{normalizedPercentage}% done</span>
          </div>
        </div>

        {/* Size Info (if available) */}
        {showSize && total > 0 && (
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground text-center">
              {formatBytes(loaded)} / {formatBytes(total)}
            </p>
          </div>
        )}

        {/* Phase Indicator */}
        <div className="flex justify-between text-xs text-muted-foreground pt-1">
          <span className={normalizedPercentage <= 35 ? 'text-blue-600 font-semibold' : ''}>
            Compress: 0-35%
          </span>
          <span className={normalizedPercentage > 35 && normalizedPercentage <= 50 ? 'text-purple-600 font-semibold' : ''}>
            Prepare: 35-50%
          </span>
          <span className={normalizedPercentage > 50 && normalizedPercentage < 100 ? 'text-orange-600 font-semibold' : ''}>
            Upload: 50-95%
          </span>
          <span className={normalizedPercentage >= 95 ? 'text-green-600 font-semibold' : ''}>
            Done: 95-100%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
