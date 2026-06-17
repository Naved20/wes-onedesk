import { useState } from "react";
import { WESDailyReportComplete, WESLessonPlan } from "@/types/wesWeeklyReport";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { useToast } from "@/hooks/use-toast";

interface WESLessonPlanSectionProps {
  dailyReport: WESDailyReportComplete;
  isEditable: boolean;
  onUpdate: () => void;
}

const WESLessonPlanSection = ({ dailyReport, isEditable, onUpdate }: WESLessonPlanSectionProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const lessonPlans = dailyReport.lesson_plans || [];

  const handleLPChange = async (lpId: string, field: keyof WESLessonPlan, value: any) => {
    try {
      await wesWeeklyReportService.updateLessonPlan(lpId, { [field]: value });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update",
        variant: "destructive",
      });
    }
  };

  const submittedCount = lessonPlans.filter(lp => lp.submitted).length;
  const reviewedCount = lessonPlans.filter(lp => lp.reviewed).length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Submitted (Yes)</p>
          <p className="text-2xl font-bold">{submittedCount} / 3</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Reviewed (Yes)</p>
          <p className="text-2xl font-bold">{reviewedCount} / 3</p>
        </div>
      </div>

      {/* Lesson Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lessonPlans.map((lp) => (
          <div key={lp.id} className="p-4 border rounded-lg space-y-3">
            <h4 className="font-semibold">LP {lp.lp_number}</h4>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`submitted-${lp.id}`}
                checked={lp.submitted}
                onCheckedChange={(checked) => handleLPChange(lp.id, "submitted", checked)}
                disabled={!isEditable}
              />
              <Label htmlFor={`submitted-${lp.id}`} className="text-sm">
                Submitted
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`reviewed-${lp.id}`}
                checked={lp.reviewed}
                onCheckedChange={(checked) => handleLPChange(lp.id, "reviewed", checked)}
                disabled={!isEditable}
              />
              <Label htmlFor={`reviewed-${lp.id}`} className="text-sm">
                Reviewed
              </Label>
            </div>

            <div>
              <Label className="text-sm">Approval Rating</Label>
              <Select
                value={lp.approval_rating?.toString() || ""}
                onValueChange={(value) => handleLPChange(lp.id, "approval_rating", parseInt(value))}
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating} / 10
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WESLessonPlanSection;
