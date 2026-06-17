import { WESDailyReportComplete } from "@/types/wesWeeklyReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import WESTaskUpdates from "./WESTaskUpdates";
import WESLessonPlanSection from "./WESLessonPlanSection";
import WESParentCallTracker from "./WESParentCallTracker";
import WESClassUpdateForm from "./WESClassUpdateForm";
import WESClosingChecklist from "./WESClosingChecklist";
import WESFeedbackForm from "./WESFeedbackForm";

interface WESDailyReportTabProps {
  dailyReport: WESDailyReportComplete;
  isEditable: boolean;
  onUpdate: () => void;
}

const formatSafeDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};

const WESDailyReportTab = ({ dailyReport, isEditable, onUpdate }: WESDailyReportTabProps) => {
  return (
    <div className="space-y-6">
      {/* Day Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{dailyReport.day_name}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {formatSafeDate(dailyReport.day_date)}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* 15:00 - Task Updates */}
      <Card>
        <CardHeader className="bg-green-50 dark:bg-green-950">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="bg-green-500 text-white px-2 py-1 rounded text-sm">15:00</span>
            Task Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <WESTaskUpdates
            dailyReport={dailyReport}
            isEditable={isEditable}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* 16:00 - Lesson Plans */}
      <Card>
        <CardHeader className="bg-blue-50 dark:bg-blue-950">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm">16:00</span>
            Lesson Plans (Next Day)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <WESLessonPlanSection
            dailyReport={dailyReport}
            isEditable={isEditable}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* 16:30 - Parent Calls */}
      <Card>
        <CardHeader className="bg-yellow-50 dark:bg-yellow-950">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="bg-yellow-500 text-white px-2 py-1 rounded text-sm">16:30</span>
            Parent Calls
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <WESParentCallTracker
            dailyReport={dailyReport}
            isEditable={isEditable}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* Class Updates */}
      <div className="space-y-4">
        {/* 16:55 - Class 1 */}
        <Card>
          <CardHeader className="bg-purple-50 dark:bg-purple-950">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="bg-purple-500 text-white px-2 py-1 rounded text-sm">16:55</span>
              Class 1 Update
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WESClassUpdateForm
              classUpdate={dailyReport.class_updates.find((c) => c.class_number === 1)}
              dailyReportId={dailyReport.id}
              classNumber={1}
              timeSlot="16:55"
              isEditable={isEditable}
              onUpdate={onUpdate}
            />
          </CardContent>
        </Card>

        {/* 17:35 - Class 2 */}
        <Card>
          <CardHeader className="bg-orange-50 dark:bg-orange-950">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-sm">17:35</span>
              Class 2 Update
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WESClassUpdateForm
              classUpdate={dailyReport.class_updates.find((c) => c.class_number === 2)}
              dailyReportId={dailyReport.id}
              classNumber={2}
              timeSlot="17:35"
              isEditable={isEditable}
              onUpdate={onUpdate}
            />
          </CardContent>
        </Card>

        {/* 18:15 - Class 3 */}
        <Card>
          <CardHeader className="bg-pink-50 dark:bg-pink-950">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="bg-pink-500 text-white px-2 py-1 rounded text-sm">18:15</span>
              Class 3 Update
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WESClassUpdateForm
              classUpdate={dailyReport.class_updates.find((c) => c.class_number === 3)}
              dailyReportId={dailyReport.id}
              classNumber={3}
              timeSlot="18:15"
              isEditable={isEditable}
              onUpdate={onUpdate}
            />
          </CardContent>
        </Card>
      </div>

      {/* Closing Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Closing Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <WESClosingChecklist
            dailyReport={dailyReport}
            isEditable={isEditable}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Incharge Feedback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Feedback */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-blue-50 dark:bg-blue-950">
            <CardTitle className="text-lg">Academic Incharge Feedback</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WESFeedbackForm
              feedback={dailyReport.academic_feedback[0]}
              dailyReportId={dailyReport.id}
              type="academic"
              isEditable={isEditable}
              onUpdate={onUpdate}
            />
          </CardContent>
        </Card>

        {/* Operations Feedback */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="bg-orange-50 dark:bg-orange-950">
            <CardTitle className="text-lg">Operations Incharge Feedback</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <WESFeedbackForm
              feedback={dailyReport.operations_feedback[0]}
              dailyReportId={dailyReport.id}
              type="operations"
              isEditable={isEditable}
              onUpdate={onUpdate}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WESDailyReportTab;
