import { useState, useEffect } from "react";
import { WESAcademicFeedback, WESOperationsFeedback } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESFeedbackFormProps {
  feedback?: WESAcademicFeedback | WESOperationsFeedback;
  dailyReportId: string;
  type: "academic" | "operations";
  isEditable: boolean;
  onUpdate: () => void;
}

const WESFeedbackForm = ({
  feedback,
  dailyReportId,
  type,
  isEditable,
  onUpdate,
}: WESFeedbackFormProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    what_is_good: feedback?.what_is_good || "",
    where_improvement_needed: feedback?.where_improvement_needed || "",
    rating: feedback?.rating || null,
    signature: feedback?.signature || "",
    feedback_date: feedback?.feedback_date || new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (feedback) {
      setFormData({
        what_is_good: feedback.what_is_good || "",
        where_improvement_needed: feedback.where_improvement_needed || "",
        rating: feedback.rating || null,
        signature: feedback.signature || "",
        feedback_date: feedback.feedback_date || new Date().toISOString().split("T")[0],
      });
    }
  }, [feedback]);

  const handleSave = async () => {
    try {
      setSaving(true);
      if (type === "academic") {
        await wesWeeklyReportService.createAcademicFeedback(dailyReportId, formData);
      } else {
        await wesWeeklyReportService.createOperationsFeedback(dailyReportId, formData);
      }
      toast({ title: "Success", description: "Feedback saved" });
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

  const getRatingLabel = (rating: number | null) => {
    if (!rating) return "Not Rated";
    if (rating <= 2) return "Very Bad";
    if (rating <= 4) return "Bad";
    if (rating <= 6) return "Good";
    if (rating <= 8) return "Very Good";
    return "Excellent";
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>What Is Good</Label>
        <Textarea
          value={formData.what_is_good}
          onChange={(e) => setFormData({ ...formData, what_is_good: e.target.value })}
          placeholder="Positive aspects..."
          rows={3}
          disabled={!isEditable}
        />
      </div>

      <div>
        <Label>Where Improvement Needed</Label>
        <Textarea
          value={formData.where_improvement_needed}
          onChange={(e) => setFormData({ ...formData, where_improvement_needed: e.target.value })}
          placeholder="Areas for improvement..."
          rows={3}
          disabled={!isEditable}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Rating (1-10)</Label>
          <Select
            value={formData.rating?.toString() || ""}
            onValueChange={(value) => setFormData({ ...formData, rating: parseInt(value) })}
            disabled={!isEditable}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <SelectItem key={rating} value={rating.toString()}>
                  {rating} - {getRatingLabel(rating)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.rating && (
            <p className="text-sm text-muted-foreground mt-1">
              {getRatingLabel(formData.rating)}
            </p>
          )}
        </div>

        <div>
          <Label>Feedback Date</Label>
          <Input
            type="date"
            value={formData.feedback_date}
            onChange={(e) => setFormData({ ...formData, feedback_date: e.target.value })}
            disabled={!isEditable}
          />
        </div>
      </div>

      <div>
        <Label>Signature</Label>
        <Input
          value={formData.signature}
          onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
          placeholder="Enter signature"
          disabled={!isEditable}
        />
      </div>

      {isEditable && !feedback && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Feedback
            </>
          )}
        </Button>
      )}

      {feedback && (
        <div className="text-sm text-muted-foreground">
          Feedback submitted by {type === "academic" ? "Academic" : "Operations"} Incharge
        </div>
      )}
    </div>
  );
};

export default WESFeedbackForm;
