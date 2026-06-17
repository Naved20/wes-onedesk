import { useState } from "react";
import { WESDailyReport } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESClosingChecklistProps {
  dailyReport: WESDailyReport;
  isEditable: boolean;
  onUpdate: () => void;
}

const WESClosingChecklist = ({ dailyReport, isEditable, onUpdate }: WESClosingChecklistProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    class_video_done: dailyReport.class_video_done || false,
    attendance_marked: dailyReport.attendance_marked || false,
    tracker_updated: dailyReport.tracker_updated || false,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await wesWeeklyReportService.updateDailyReport(dailyReport.id, formData);
      toast({ title: "Success", description: "Checklist saved" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const allComplete = formData.class_video_done && formData.attendance_marked && formData.tracker_updated;

  return (
    <div className="space-y-4">
      {allComplete && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">All tasks completed!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="class_video_done"
            checked={formData.class_video_done}
            onCheckedChange={(checked) => setFormData({ ...formData, class_video_done: !!checked })}
            disabled={!isEditable}
          />
          <Label htmlFor="class_video_done" className="text-sm font-medium">
            Class Video
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="attendance_marked"
            checked={formData.attendance_marked}
            onCheckedChange={(checked) => setFormData({ ...formData, attendance_marked: !!checked })}
            disabled={!isEditable}
          />
          <Label htmlFor="attendance_marked" className="text-sm font-medium">
            Attendance
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="tracker_updated"
            checked={formData.tracker_updated}
            onCheckedChange={(checked) => setFormData({ ...formData, tracker_updated: !!checked })}
            disabled={!isEditable}
          />
          <Label htmlFor="tracker_updated" className="text-sm font-medium">
            Tracker
          </Label>
        </div>
      </div>

      {isEditable && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Checklist
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default WESClosingChecklist;
