import { useState } from "react";
import { WESDailyReport } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Phone } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESParentCallTrackerProps {
  dailyReport: WESDailyReport;
  isEditable: boolean;
  onUpdate: () => void;
}

const WESParentCallTracker = ({ dailyReport, isEditable, onUpdate }: WESParentCallTrackerProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    parents_called: dailyReport.parents_called || 0,
    parents_received: dailyReport.parents_received || 0,
    parent_call_comments: dailyReport.parent_call_comments || "",
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await wesWeeklyReportService.updateDailyReport(dailyReport.id, formData);
      toast({ title: "Success", description: "Parent calls saved" });
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="parents_called" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Called
          </Label>
          <Input
            id="parents_called"
            type="number"
            min="0"
            value={formData.parents_called}
            onChange={(e) => setFormData({ ...formData, parents_called: parseInt(e.target.value) || 0 })}
            disabled={!isEditable}
          />
        </div>

        <div>
          <Label htmlFor="parents_received">Received</Label>
          <Input
            id="parents_received"
            type="number"
            min="0"
            value={formData.parents_received}
            onChange={(e) => setFormData({ ...formData, parents_received: parseInt(e.target.value) || 0 })}
            disabled={!isEditable}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="parent_call_comments">Comments / How It Helped</Label>
        <Textarea
          id="parent_call_comments"
          value={formData.parent_call_comments}
          onChange={(e) => setFormData({ ...formData, parent_call_comments: e.target.value })}
          placeholder="Describe parent call outcomes..."
          rows={4}
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
              Save Parent Calls
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default WESParentCallTracker;
