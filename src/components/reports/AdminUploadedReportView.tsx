import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { uploadedReportService } from "@/services/uploadedReportService";
import { AdminReportView, WeeklyReportGroup, UploadedReport } from "@/types/uploadedReport";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminUploadedReportViewProps {
  year?: number;
  month?: number;
}

export function AdminUploadedReportView({ year, month }: AdminUploadedReportViewProps) {
  const { toast } = useToast();
  const [reportView, setReportView] = useState<AdminReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0]));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; reportId?: string }>({
    open: false,
  });

  useEffect(() => {
    loadReports();
  }, [year, month]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const view = await uploadedReportService.getAdminReportView(year, month);
      setReportView(view);
      // Expand first week by default
      setExpandedWeeks(new Set([0]));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = (weekNumber: number) => {
    const newSet = new Set(expandedWeeks);
    if (newSet.has(weekNumber)) {
      newSet.delete(weekNumber);
    } else {
      newSet.add(weekNumber);
    }
    setExpandedWeeks(newSet);
  };

  const toggleDay = (dayKey: string) => {
    const newSet = new Set(expandedDays);
    if (newSet.has(dayKey)) {
      newSet.delete(dayKey);
    } else {
      newSet.add(dayKey);
    }
    setExpandedDays(newSet);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.reportId) return;

    try {
      await uploadedReportService.deleteReport(deleteConfirm.reportId);
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
      setDeleteConfirm({ open: false });
      loadReports();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    }
  };

  const ReportCard = ({ report }: { report: UploadedReport }) => (
    <div className="p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="font-medium truncate text-sm">
              Report - {format(new Date(report.report_date), "MMM dd, yyyy")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            By: <span className="font-medium">{report.employee_name}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {report.file_url && (
              <span className="text-xs text-green-600">✓ File on Google Drive</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {report.file_url && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => window.open(report.file_url, "_blank")}
              title="Open in Google Drive"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm({ open: true, reportId: report.id })}
            title="Delete report"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const DayGroup = ({
    dayName,
    reports,
    dayKey,
  }: {
    dayName: string;
    reports: UploadedReport[];
    dayKey: string;
  }) => {
    const isExpanded = expandedDays.has(dayKey);

    if (reports.length === 0) return null;

    return (
      <div className="pl-4 border-l border-muted">
        <button
          onClick={() => toggleDay(dayKey)}
          className="flex items-center gap-2 w-full py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="font-medium text-sm">{dayName}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {reports.length}
          </Badge>
        </button>

        {isExpanded && (
          <div className="pl-6 space-y-2 py-2">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const WeekGroup = ({ weekGroup }: { weekGroup: WeeklyReportGroup }) => {
    const isExpanded = expandedWeeks.has(weekGroup.week_number);
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <button
            onClick={() => toggleWeek(weekGroup.week_number)}
            className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded transition-colors"
          >
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 flex-shrink-0" />
              )}
              <div className="text-left">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Week {weekGroup.week_number}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(weekGroup.week_start_date), "MMM dd")} -{" "}
                  {format(new Date(weekGroup.week_end_date), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
            <Badge className="ml-2">
              {weekGroup.reports.length} Report{weekGroup.reports.length !== 1 ? "s" : ""}
            </Badge>
          </button>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-3">
            {dayOrder
              .filter((day) => weekGroup.day_groups[day]?.length > 0)
              .map((day) => (
                <DayGroup
                  key={day}
                  dayName={day}
                  reports={weekGroup.day_groups[day]}
                  dayKey={`${weekGroup.week_number}-${day}`}
                />
              ))}
          </CardContent>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-full" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!reportView || reportView.total_reports === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No reports uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  const monthName = format(new Date(reportView.current_month.year, reportView.current_month.month_number - 1), "MMMM yyyy");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">📋 Uploaded Weekly Reports</h2>
        <p className="text-muted-foreground">
          {monthName} • {reportView.total_reports} report{reportView.total_reports !== 1 ? "s" : ""} submitted
        </p>
      </div>

      {/* Weekly View */}
      <div className="space-y-4">
        {reportView.current_month.weeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No reports for this month</p>
            </CardContent>
          </Card>
        ) : (
          reportView.current_month.weeks.map((week) => (
            <WeekGroup key={`week-${week.week_number}`} weekGroup={week} />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
