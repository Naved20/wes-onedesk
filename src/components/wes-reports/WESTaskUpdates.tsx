import { useState } from "react";
import { WESDailyReport } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESTaskUpdatesProps {
  dailyReport: WESDailyReport;
  isEditable: boolean;
  onUpdate: () => void;
}

const WESTaskUpdates = ({ dailyReport, isEditable, onUpdate }: WESTaskUpdatesProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    my_attendance: dailyReport.my_attendance || 0,
    total_strength: dailyReport.total_strength || 0,
    progress_tracker_updated: dailyReport.progress_tracker_updated || "",
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await wesWeeklyReportService.updateDailyReport(dailyReport.id, formData);
      toast({ title: "Success", description: "Task updates saved" });
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

  const attendancePercentage = formData.total_strength > 0 
    ? ((formData.my_attendance / formData.total_strength) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="my_attendance">My Attendance</Label>
          <Input
            id="my_attendance"
            type="number"
            min="0"
            value={formData.my_attendance}
            onChange={(e) => setFormData({ ...formData, my_attendance: parseInt(e.target.value) || 0 })}
            disabled={!isEditable}
          />
        </div>

        <div>
          <Label htmlFor="total_strength">Total Strength</Label>
          <Input
            id="total_strength"
            type="number"
            min="0"
            value={formData.total_strength}
            onChange={(e) => setFormData({ ...formData, total_strength: parseInt(e.target.value) || 0 })}
            disabled={!isEditable}
          />
        </div>

        <div>
          <Label>Attendance %</Label>
          <div className="h-10 flex items-center justify-center bg-muted rounded-md font-semibold">
            {attendancePercentage}%
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="progress_tracker">Progress Tracker Updated</Label>
        <Textarea
          id="progress_tracker"
          value={formData.progress_tracker_updated}
          onChange={(e) => setFormData({ ...formData, progress_tracker_updated: e.target.value })}
          placeholder="Describe progress tracker updates..."
          rows={3}
          disabled={!isEditable}
        />
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
              Save Task Updates
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default WESTaskUpdates;
