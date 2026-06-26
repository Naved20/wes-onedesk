import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  AlertCircle,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { uploadedReportService } from "@/services/uploadedReportService";
import { UploadedReport } from "@/types/uploadedReport";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface EmployeeReports {
  [employeeId: string]: {
    name: string;
    byMonth: {
      [month: string]: {
        byWeek: {
          [weekKey: string]: {
            weekStart: string;
            weekEnd: string;
            reports: UploadedReport[];
          };
        };
      };
    };
  };
}

export default function UploadedReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "reports">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; reportId?: string; employeeName?: string }>({
    open: false,
  });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const data = await uploadedReportService.getAllReportsForMonth(year, month);
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

  const organizeReports = (): EmployeeReports => {
    const organized: EmployeeReports = {};

    for (const report of reports) {
      if (!organized[report.employee_id]) {
        organized[report.employee_id] = {
          name: report.employee_name,
          byMonth: {},
        };
      }

      const monthKey = report.report_date.substring(0, 7); // YYYY-MM
      if (!organized[report.employee_id].byMonth[monthKey]) {
        organized[report.employee_id].byMonth[monthKey] = {
          byWeek: {},
        };
      }

      const reportDate = new Date(report.report_date);
      const weekStart = startOfWeek(reportDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!organized[report.employee_id].byMonth[monthKey].byWeek[weekKey]) {
        const weekEnd = endOfWeek(reportDate, { weekStartsOn: 1 });
        organized[report.employee_id].byMonth[monthKey].byWeek[weekKey] = {
          weekStart: format(weekStart, "yyyy-MM-dd"),
          weekEnd: format(weekEnd, "yyyy-MM-dd"),
          reports: [],
        };
      }

      organized[report.employee_id].byMonth[monthKey].byWeek[weekKey].reports.push(report);
    }

    return organized;
  };

  const toggleEmployee = (employeeId: string) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(employeeId)) {
      newSet.delete(employeeId);
    } else {
      newSet.add(employeeId);
    }
    setExpandedEmployees(newSet);
  };

  const toggleMonth = (key: string) => {
    const newSet = new Set(expandedMonths);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedMonths(newSet);
  };

  const toggleWeek = (key: string) => {
    const newSet = new Set(expandedWeeks);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedWeeks(newSet);
  };

  const ReportRow = ({ report }: { report: UploadedReport }) => (
    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-medium">
          {format(new Date(report.report_date), "EEEE, MMM dd, yyyy")}
        </p>
        <p className="text-xs text-muted-foreground">
          Submitted: {format(new Date(report.created_at), "MMM dd, yyyy HH:mm")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {report.file_url && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            ✓ Uploaded
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => window.open(report.file_url, "_blank")}
          title="Open file"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={() => setDeleteConfirm({ 
            open: true, 
            reportId: report.id,
            employeeName: report.employee_name 
          })}
          title="Delete report"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const organized = organizeReports();
  const totalReports = reports.length;
  const totalEmployees = Object.keys(organized).length;

  // Filter employees by search
  let filteredEmployees = Object.entries(organized).filter(([_, data]) =>
    data.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort employees
  filteredEmployees.sort(([_, dataA], [__, dataB]) => {
    let compareValue = 0;

    if (sortBy === "name") {
      compareValue = dataA.name.localeCompare(dataB.name);
    } else {
      const countA = Object.values(dataA.byMonth).reduce(
        (sum, month) => sum + Object.values(month.byWeek).reduce((s, week) => s + week.reports.length, 0),
        0
      );
      const countB = Object.values(dataB.byMonth).reduce(
        (sum, month) => sum + Object.values(month.byWeek).reduce((s, week) => s + week.reports.length, 0),
        0
      );
      compareValue = countA - countB;
    }

    return sortOrder === "asc" ? compareValue : -compareValue;
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">📋 Uploaded Weekly Reports</h1>
          <p className="text-muted-foreground">
            {totalReports} report{totalReports !== 1 ? "s" : ""} from {totalEmployees} employee{totalEmployees !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Current Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{format(new Date(), "MMM yyyy")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Sort Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters & Sorting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Sort by:</span>
                <Button
                  variant={sortBy === "name" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("name")}
                >
                  Name
                </Button>
                <Button
                  variant={sortBy === "reports" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("reports")}
                >
                  Reports
                </Button>
              </div>

              {/* Sort Order */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="flex items-center gap-2"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === "asc" ? "Ascending" : "Descending"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Employees</CardTitle>
            <CardDescription>
              {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No employees match your search" : "No reports found"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-right">Reports</TableHead>
                      <TableHead className="text-right">Months</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map(([employeeId, employeeData]) => {
                      const isExpanded = expandedEmployees.has(employeeId);
                      const reportCount = Object.values(employeeData.byMonth).reduce(
                        (sum, month) => sum + Object.values(month.byWeek).reduce((s, week) => s + week.reports.length, 0),
                        0
                      );

                      return (
                        <>
                          <TableRow
                            key={employeeId}
                            className="hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleEmployee(employeeId)}
                          >
                            <TableCell>
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">👤 {employeeData.name}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge>{reportCount}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{Object.keys(employeeData.byMonth).length}</Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={4}>
                                <div className="space-y-4 p-4">
                                  {Object.entries(employeeData.byMonth).map(([monthKey, monthData]) => {
                                    const monthExpandKey = `${employeeId}-${monthKey}`;
                                    const isMonthExpanded = expandedMonths.has(monthExpandKey);

                                    return (
                                      <div key={monthKey} className="space-y-2 border-l-2 border-gray-200 dark:border-gray-800 pl-4">
                                        {/* Month Header */}
                                        <button
                                          onClick={() => toggleMonth(monthExpandKey)}
                                          className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            {isMonthExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                            <span className="font-medium">{format(new Date(monthKey + "-01"), "MMMM yyyy")}</span>
                                          </div>
                                          <Badge variant="outline">
                                            {Object.values(monthData.byWeek).reduce((sum, week) => sum + week.reports.length, 0)} reports
                                          </Badge>
                                        </button>

                                        {/* Weeks */}
                                        {isMonthExpanded && (
                                          <div className="space-y-3 mt-2 pl-4">
                                            {Object.entries(monthData.byWeek).map(([weekKey, weekData]) => {
                                              const weekExpandKey = `${monthExpandKey}-${weekKey}`;
                                              const isWeekExpanded = expandedWeeks.has(weekExpandKey);

                                              return (
                                                <div key={weekKey} className="border-l-2 border-blue-200 dark:border-blue-800 pl-4">
                                                  {/* Week Header */}
                                                  <button
                                                    onClick={() => toggleWeek(weekExpandKey)}
                                                    className="flex items-center justify-between w-full p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded hover:bg-blue-100/50 dark:hover:bg-blue-950/40 transition-colors"
                                                  >
                                                    <div className="flex items-center gap-2 text-sm">
                                                      {isWeekExpanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                      ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                      )}
                                                      <span className="font-medium">
                                                        Week {format(new Date(weekKey), "d MMM")} - {format(new Date(weekData.weekEnd), "d MMM")}
                                                      </span>
                                                    </div>
                                                    <Badge variant="secondary" className="text-xs">
                                                      {weekData.reports.length}
                                                    </Badge>
                                                  </button>

                                                  {/* Reports */}
                                                  {isWeekExpanded && (
                                                    <div className="space-y-2 mt-3">
                                                      {weekData.reports
                                                        .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
                                                        .map((report) => (
                                                          <div key={report.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors">
                                                            <div className="flex-1">
                                                              <p className="text-sm font-medium">
                                                                {format(new Date(report.report_date), "EEEE, MMM dd, yyyy")}
                                                              </p>
                                                              <p className="text-xs text-muted-foreground">
                                                                Submitted: {format(new Date(report.created_at), "MMM dd, yyyy HH:mm")}
                                                              </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              {report.file_url && (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                  ✓ Uploaded
                                                                </Badge>
                                                              )}
                                                              <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => window.open(report.file_url, "_blank")}
                                                                title="Open file"
                                                              >
                                                                <ExternalLink className="h-4 w-4" />
                                                              </Button>
                                                              <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                                onClick={() => setDeleteConfirm({ 
                                                                  open: true, 
                                                                  reportId: report.id,
                                                                  employeeName: report.employee_name 
                                                                })}
                                                                title="Delete report"
                                                              >
                                                                <Trash2 className="h-4 w-4" />
                                                              </Button>
                                                            </div>
                                                          </div>
                                                        ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
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
    </DashboardLayout>
  );
}
