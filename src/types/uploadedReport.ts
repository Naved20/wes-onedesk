export interface UploadedReport {
  id: string;
  employee_id: string;
  employee_name: string;
  report_date: string; // ISO date string
  file_url: string; // Google Drive link
  created_at: string;
  updated_at: string;
}

export interface WeeklyReportGroup {
  week_start_date: string;
  week_end_date: string;
  week_number: number;
  reports: UploadedReport[];
  day_groups: {
    [key: string]: UploadedReport[]; // "Monday", "Tuesday", etc.
  };
}

export interface MonthlyReportGroup {
  month: string; // "2026-01"
  year: number;
  month_number: number;
  weeks: WeeklyReportGroup[];
  total_reports: number;
}

export interface AdminReportView {
  current_month: MonthlyReportGroup;
  total_reports: number;
  reports_by_employee: {
    [employee_id: string]: UploadedReport[];
  };
}

export interface CreateUploadedReportDTO {
  report_date: string;
  file_url: string;
}
