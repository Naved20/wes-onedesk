import { supabase } from "@/integrations/supabase/client";
import {
  UploadedReport,
  CreateUploadedReportDTO,
  WeeklyReportGroup,
  MonthlyReportGroup,
  AdminReportView,
} from "@/types/uploadedReport";
import { startOfWeek, endOfWeek, format, parse } from "date-fns";

export const uploadedReportService = {
  // ==================== CREATE ====================

  async uploadReport(
    employeeId: string,
    employeeName: string,
    dto: CreateUploadedReportDTO
  ): Promise<UploadedReport> {
    const { data, error } = await supabase
      .from("uploaded_reports")
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== READ ====================

  async getEmployeeReports(employeeId: string): Promise<UploadedReport[]> {
    const { data, error } = await supabase
      .from("uploaded_reports")
      .select("*")
      .eq("employee_id", employeeId)
      .order("report_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getReportById(reportId: string): Promise<UploadedReport> {
    const { data, error } = await supabase
      .from("uploaded_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== ADMIN VIEW ====================

  async getAllReportsForMonth(year: number, month: number): Promise<UploadedReport[]> {
    const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("uploaded_reports")
      .select("*")
      .gte("report_date", startDate)
      .lte("report_date", endDate)
      .order("report_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAdminReportView(year?: number, month?: number): Promise<AdminReportView> {
    const now = new Date();
    const currentYear = year || now.getFullYear();
    const currentMonth = month || now.getMonth() + 1;

    // Get all reports for current month
    const reports = await this.getAllReportsForMonth(currentYear, currentMonth);

    // Group by week
    const weeklyGroups: WeeklyReportGroup[] = [];
    const weekMap = new Map<string, UploadedReport[]>();

    // Sort reports by date
    const sortedReports = reports.sort(
      (a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
    );

    // Group by week
    for (const report of sortedReports) {
      const reportDate = new Date(report.report_date);
      // Get week start (Monday) and end (Sunday)
      const weekStart = startOfWeek(reportDate, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(reportDate, { weekStartsOn: 1 }); // Sunday
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(report);
    }

    // Convert to weekly groups with day grouping
    let weekNumber = 1;
    for (const [weekStartStr, reportsInWeek] of weekMap.entries()) {
      const weekStart = parse(weekStartStr, "yyyy-MM-dd", new Date());
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      // Group by day name
      const dayGroups: { [key: string]: UploadedReport[] } = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
      };

      for (const report of reportsInWeek) {
        const dayName = format(new Date(report.report_date), "EEEE");
        if (dayGroups[dayName]) {
          dayGroups[dayName].push(report);
        }
      }

      weeklyGroups.push({
        week_start_date: format(weekStart, "yyyy-MM-dd"),
        week_end_date: format(weekEnd, "yyyy-MM-dd"),
        week_number: weekNumber,
        reports: reportsInWeek,
        day_groups: dayGroups,
      });

      weekNumber++;
    }

    // Group employee reports
    const reportsByEmployee: { [key: string]: UploadedReport[] } = {};
    for (const report of sortedReports) {
      if (!reportsByEmployee[report.employee_id]) {
        reportsByEmployee[report.employee_id] = [];
      }
      reportsByEmployee[report.employee_id].push(report);
    }

    return {
      current_month: {
        month: format(new Date(currentYear, currentMonth - 1), "yyyy-MM"),
        year: currentYear,
        month_number: currentMonth,
        weeks: weeklyGroups,
        total_reports: sortedReports.length,
      },
      total_reports: sortedReports.length,
      reports_by_employee: reportsByEmployee,
    };
  },

  // ==================== DELETE ====================

  async deleteReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from("uploaded_reports")
      .delete()
      .eq("id", reportId);

    if (error) throw error;
  },
};
