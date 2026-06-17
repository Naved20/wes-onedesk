import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { wesWeeklyReportService } from "@/services/wesWeeklyReportService";
import { WESWeeklyReport } from "@/types/wesWeeklyReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, TrendingUp, CheckCircle, Clock, Users, Mail, Phone, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const formatSafeDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};

const WESTeacherReports = () => {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<WESWeeklyReport[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    teacher_name: "",
    class_batch: "",
    week_start_date: "",
  });

  useEffect(() => {
    if (user) {
      loadReports();
      loadStats();
    }
  }, [user, role]);

  const loadReports = async () => {
    try {
      setLoading(true);
      let data;
      
      if (role === "admin" || role === "manager") {
        // Admin/Manager sees all reports with employee details
        data = await wesWeeklyReportService.getAllWeeklyReportsWithEmployeeDetails();
      } else {
        // Employee sees only their own reports
        data = await wesWeeklyReportService.getTeacherWeeklyReports(user!.id);
      }
      
      setReports(data);
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

  const loadStats = async () => {
    try {
      let data;
      
      if (role === "admin" || role === "manager") {
        // Admin/Manager sees organization-wide stats
        data = await wesWeeklyReportService.getOrganizationStats();
      } else {
        // Employee sees their own stats
        data = await wesWeeklyReportService.getTeacherStats(user!.id);
      }
      
      setStats(data);
    } catch (error: any) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleCreateReport = async () => {
    if (!newReport.teacher_name || !newReport.class_batch || !newReport.week_start_date) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const reportId = await wesWeeklyReportService.createWeekWithDailyReports(
        user!.id,
        newReport.teacher_name,
        newReport.class_batch,
        newReport.week_start_date
      );
      
      toast({
        title: "Success",
        description: "Weekly report created successfully",
      });
      
      setCreateDialogOpen(false);
      setNewReport({ teacher_name: "", class_batch: "", week_start_date: "" });
      loadReports();
      
      // Navigate to edit form
      navigate(`/wes-reports/${reportId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create report",
        variant: "destructive",
      });
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {role === "admin" || role === "manager" ? "WES Academy Reports - All Teachers" : "WES Academy Weekly Reports"}
          </h1>
          <p className="text-muted-foreground">
            {role === "admin" || role === "manager" 
              ? "View and manage reports from all teachers" 
              : "Track your weekly teaching activities"}
          </p>
        </div>
        
        {(role === "employee") && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Weekly Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="teacher_name">Teacher Name *</Label>
                  <Input
                    id="teacher_name"
                    value={newReport.teacher_name}
                    onChange={(e) => setNewReport({ ...newReport, teacher_name: e.target.value })}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <Label htmlFor="class_batch">Class/Batch *</Label>
                  <Input
                    id="class_batch"
                    value={newReport.class_batch}
                    onChange={(e) => setNewReport({ ...newReport, class_batch: e.target.value })}
                    placeholder="e.g., Class 10A, Batch 2026"
                  />
                </div>
                <div>
                  <Label htmlFor="week_start_date">Week Start Date (Saturday) *</Label>
                  <Input
                    id="week_start_date"
                    type="date"
                    value={newReport.week_start_date}
                    onChange={(e) => setNewReport({ ...newReport, week_start_date: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateReport} className="w-full">
                  Create Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {role === "admin" || role === "manager" ? "Total Reports" : "Total Reports"}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_reports}</div>
            </CardContent>
          </Card>

          {(role === "admin" || role === "manager") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_teachers}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_approval}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.average_attendance.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lesson Plans Submitted</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_lesson_plans_submitted}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {role === "admin" || role === "manager" ? "All Reports" : "Your Reports"}
        </h2>
        
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No reports yet</p>
              {role === "employee" && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Report
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report: any) => (
              <Card
                key={report.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/wes-reports/${report.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{report.class_batch}</CardTitle>
                      <p className="text-sm font-medium text-foreground">{report.teacher_name}</p>
                      
                      {/* Admin/Manager: Show employee details */}
                      {(role === "admin" || role === "manager") && report.employee_profile && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground truncate">{report.employee_profile.email}</span>
                          </div>
                          {report.employee_profile.phone && (
                            <div className="flex items-center gap-2 text-xs">
                              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">{report.employee_profile.phone}</span>
                            </div>
                          )}
                          {report.employee_profile.designation && (
                            <div className="flex items-center gap-2 text-xs">
                              <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">{report.employee_profile.designation}</span>
                            </div>
                          )}
                          {report.employee_profile.department && (
                            <p className="text-xs text-muted-foreground">
                              Dept: {report.employee_profile.department}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(report.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{formatSafeDate(report.week_start_date)} - {formatSafeDate(report.week_end_date)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">Attendance</div>
                      <div className="font-semibold">{report.total_attendance_percentage?.toFixed(1) || 0}%</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-xs text-muted-foreground">LPs Submitted</div>
                      <div className="font-semibold">{report.total_lesson_plans_submitted || 0}</div>
                    </div>
                  </div>

                  {report.submitted_at && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Submitted: {formatSafeDate(report.submitted_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
};

export default WESTeacherReports;
