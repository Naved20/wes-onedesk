import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { WESWeeklyReportComplete } from "@/types/wesWeeklyReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WESDailyReportTab from "@/components/wes-reports/WESDailyReportTab";
import WESChallengeManager from "@/components/wes-reports/WESChallengeManager";
import WESSummaryTab from "@/components/wes-reports/WESSummaryTab";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const formatSafeDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};

const WESWeeklyReportForm = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [report, setReport] = useState<WESWeeklyReportComplete | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("saturday");

  useEffect(() => {
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await wesWeeklyReportService.getWeeklyReport(reportId!);
      setReport(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load report",
        variant: "destructive",
      });
      navigate("/wes-reports");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!report) return;

    try {
      setSaving(true);

      // Calculate stats before submitting
      await wesWeeklyReportService.calculateReportStats(report.id);

      // Submit the report
      await wesWeeklyReportService.submitWeeklyReport(report.id);

      toast({
        title: "Success",
        description: "Report submitted for approval",
      });

      navigate("/wes-reports");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      submitted: { variant: "default", label: "Submitted" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
    };

    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div>Report not found</div>
      </DashboardLayout>
    );
  }

  const isDraft = report.status === "draft";
  const dailyReports = report.daily_reports || [];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/wes-reports")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Report</h1>
              <p className="text-muted-foreground">
                {report.teacher_name} | {report.class_batch}
              </p>
            </div>
          </div>
          {getStatusBadge(report.status)}
        </div>

        {/* Week Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Week Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Week Period</p>
                <p className="font-semibold">
                  {formatSafeDate(report.week_start_date)} - {formatSafeDate(report.week_end_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Attendance</p>
                <p className="font-semibold">{report.total_attendance_percentage?.toFixed(1) || 0}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lesson Plans</p>
                <p className="font-semibold">
                  {report.total_lesson_plans_submitted || 0} / {report.total_lesson_plans_reviewed || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8">
            {dailyReports.map((daily) => (
              <TabsTrigger key={daily.id} value={daily.day_name.toLowerCase()}>
                {daily.day_name.substring(0, 3)}
              </TabsTrigger>
            ))}
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {dailyReports.map((daily) => (
            <TabsContent key={daily.id} value={daily.day_name.toLowerCase()}>
              <WESDailyReportTab
                dailyReport={daily}
                isEditable={isDraft}
                onUpdate={loadReport}
              />
            </TabsContent>
          ))}

          <TabsContent value="challenges">
            <WESChallengeManager
              weeklyReportId={report.id}
              challenges={report.challenges || []}
              isEditable={isDraft}
              onUpdate={loadReport}
            />
          </TabsContent>

          <TabsContent value="summary">
            <WESSummaryTab report={report} />
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        {isDraft && (
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/wes-reports")}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Approval
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WESWeeklyReportForm;
