import { WESWeeklyReportComplete } from "@/types/wesWeeklyReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  TrendingUp,
  CheckCircle,
  Star,
  Users,
  Phone,
  BookOpen,
  Award,
} from "lucide-react";

interface WESSummaryTabProps {
  report: WESWeeklyReportComplete;
}

const formatSafeDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};

const WESSummaryTab = ({ report }: WESSummaryTabProps) => {
  const dailyReports = report.daily_reports || [];
  
  // Calculate totals
  const totalParentsCalled = dailyReports.reduce((sum, d) => sum + (d.parents_called || 0), 0);
  const totalParentsReceived = dailyReports.reduce((sum, d) => sum + (d.parents_received || 0), 0);
  
  const allLessonPlans = dailyReports.flatMap((d) => d.lesson_plans || []);
  const submittedLPs = allLessonPlans.filter((lp) => lp.submitted).length;
  const reviewedLPs = allLessonPlans.filter((lp) => lp.reviewed).length;
  const totalLPs = allLessonPlans.length;
  
  const allClassUpdates = dailyReports.flatMap((d) => d.class_updates || []);
  const totalChaptersComplete = allClassUpdates.reduce(
    (sum, c) => sum + (c.chapters_topics_complete || 0),
    0
  );

  const academicFeedbacks = dailyReports.flatMap((d) => d.academic_feedback || []);
  const operationsFeedbacks = dailyReports.flatMap((d) => d.operations_feedback || []);
  
  const avgAcademicRating = academicFeedbacks.length > 0
    ? academicFeedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / academicFeedbacks.length
    : 0;
    
  const avgOperationsRating = operationsFeedbacks.length > 0
    ? operationsFeedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / operationsFeedbacks.length
    : 0;

  const daysFilledCount = dailyReports.filter(
    (d) => d.my_attendance > 0 || d.progress_tracker_updated
  ).length;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Weekly Report Summary</CardTitle>
          <p className="text-muted-foreground">
            {report.teacher_name} | {report.class_batch}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Week Period
              </p>
              <p className="font-semibold">
                {formatSafeDate(report.week_start_date)} - {formatSafeDate(report.week_end_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={report.status === "approved" ? "default" : "secondary"}>
                {report.status.toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Days Filled</p>
              <p className="font-semibold">{daysFilledCount} / 6</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.total_attendance_percentage?.toFixed(1) || 0}%
            </div>
            <Progress
              value={report.total_attendance_percentage || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lesson Plans</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submittedLPs} / {totalLPs}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {reviewedLPs} reviewed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parent Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParentsCalled}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalParentsReceived} received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chapters Complete</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChaptersComplete}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all classes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Ratings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Incharge Feedback Ratings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Academic Incharge</span>
                <Badge variant="default">{avgAcademicRating.toFixed(1)} / 10</Badge>
              </div>
              <Progress value={avgAcademicRating * 10} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {academicFeedbacks.length} feedback entries
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Operations Incharge</span>
                <Badge variant="default">{avgOperationsRating.toFixed(1)} / 10</Badge>
              </div>
              <Progress value={avgOperationsRating * 10} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {operationsFeedbacks.length} feedback entries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Challenges Summary */}
      {report.challenges && report.challenges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Challenges & Solutions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {report.challenges.length} challenge(s) documented this week
            </p>
            <div className="space-y-3">
              {report.challenges.map((challenge, index) => (
                <div key={challenge.id} className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold text-sm">#{index + 1}: {challenge.challenge_description}</p>
                  {challenge.solution_applied && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Solution: {challenge.solution_applied}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Completion Status */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Completion Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyReports.map((daily) => {
              const hasData = daily.my_attendance > 0 || daily.progress_tracker_updated;
              const lpCount = daily.lesson_plans?.filter((lp) => lp.submitted).length || 0;
              const classCount = daily.class_updates?.filter((c) => c.unit_name).length || 0;
              
              return (
                <div key={daily.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-semibold">{daily.day_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSafeDate(daily.day_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-center">
                      <p className="font-semibold">{lpCount}/3</p>
                      <p className="text-muted-foreground">LPs</p>
                    </div>
                    <div className="text-sm text-center">
                      <p className="font-semibold">{classCount}/3</p>
                      <p className="text-muted-foreground">Classes</p>
                    </div>
                    <Badge variant={hasData ? "default" : "secondary"}>
                      {hasData ? "Filled" : "Pending"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WESSummaryTab;
