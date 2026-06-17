import { useState, useEffect } from "react";
import { WESClassUpdate } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESClassUpdateFormProps {
  classUpdate?: WESClassUpdate;
  dailyReportId: string;
  classNumber: 1 | 2 | 3;
  timeSlot: "16:55" | "17:35" | "18:15";
  isEditable: boolean;
  onUpdate: () => void;
}

const WESClassUpdateForm = ({
  classUpdate,
  dailyReportId,
  classNumber,
  timeSlot,
  isEditable,
  onUpdate,
}: WESClassUpdateFormProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    unit_name: classUpdate?.unit_name || "",
    chapter_name: classUpdate?.chapter_name || "",
    learning_outcomes: classUpdate?.learning_outcomes || "",
    what_went_well: classUpdate?.what_went_well || "",
    chapters_topics_complete: classUpdate?.chapters_topics_complete || 0,
    summary: classUpdate?.summary || "",
  });

  useEffect(() => {
    if (classUpdate) {
      setFormData({
        unit_name: classUpdate.unit_name || "",
        chapter_name: classUpdate.chapter_name || "",
        learning_outcomes: classUpdate.learning_outcomes || "",
        what_went_well: classUpdate.what_went_well || "",
        chapters_topics_complete: classUpdate.chapters_topics_complete || 0,
        summary: classUpdate.summary || "",
      });
    }
  }, [classUpdate]);

  const handleSave = async () => {
    try {
      setSaving(true);
      if (classUpdate) {
        await wesWeeklyReportService.updateClassUpdate(classUpdate.id, formData);
      } else {
        await wesWeeklyReportService.createClassUpdate(dailyReportId, {
          ...formData,
          class_number: classNumber,
          time_slot: timeSlot,
        });
      }
      toast({ title: "Success", description: "Class update saved" });
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
          <Label htmlFor={`unit-${classNumber}`}>Unit</Label>
          <Input
            id={`unit-${classNumber}`}
            value={formData.unit_name}
            onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
            placeholder="Unit number/name"
            disabled={!isEditable}
          />
        </div>

        <div>
          <Label htmlFor={`chapter-${classNumber}`}>Chapter</Label>
          <Input
            id={`chapter-${classNumber}`}
            value={formData.chapter_name}
            onChange={(e) => setFormData({ ...formData, chapter_name: e.target.value })}
            placeholder="Chapter number/name"
            disabled={!isEditable}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`learning-outcomes-${classNumber}`}>Learning Outcomes</Label>
        <Textarea
          id={`learning-outcomes-${classNumber}`}
          value={formData.learning_outcomes}
          onChange={(e) => setFormData({ ...formData, learning_outcomes: e.target.value })}
          placeholder="What students learned today..."
          rows={3}
          disabled={!isEditable}
        />
      </div>

      <div>
        <Label htmlFor={`what-went-well-${classNumber}`}>What Went Well</Label>
        <Textarea
          id={`what-went-well-${classNumber}`}
          value={formData.what_went_well}
          onChange={(e) => setFormData({ ...formData, what_went_well: e.target.value })}
          placeholder="Positive highlights from class..."
          rows={2}
          disabled={!isEditable}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`chapters-complete-${classNumber}`}>Chapters/Topics Complete</Label>
          <Input
            id={`chapters-complete-${classNumber}`}
            type="number"
            min="0"
            value={formData.chapters_topics_complete}
            onChange={(e) => setFormData({ ...formData, chapters_topics_complete: parseInt(e.target.value) || 0 })}
            disabled={!isEditable}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`summary-${classNumber}`}>Summary</Label>
        <Textarea
          id={`summary-${classNumber}`}
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          placeholder="Overall summary of the class..."
          rows={2}
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
              Save Class Update
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default WESClassUpdateForm;
