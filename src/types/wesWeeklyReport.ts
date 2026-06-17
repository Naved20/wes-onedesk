// WES Academy Weekly Report Types

export interface WESWeeklyReport {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class_batch: string;
  week_start_date: string;
  week_end_date: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  total_attendance_percentage: number;
  total_lesson_plans_submitted: number;
  total_lesson_plans_reviewed: number;
  average_academic_rating: number;
  average_operations_rating: number;
  created_at: string;
  updated_at: string;
}

export interface WESDailyReport {
  id: string;
  weekly_report_id: string;
  day_name: "Saturday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  day_date: string;
  
  // Task Updates
  my_attendance: number;
  total_strength: number;
  progress_tracker_updated: string;
  
  // Parent Calls
  parents_called: number;
  parents_received: number;
  parent_call_comments: string;
  
  // Closing Checklist
  class_video_done: boolean;
  attendance_marked: boolean;
  tracker_updated: boolean;
  
  created_at: string;
}

export interface WESLessonPlan {
  id: string;
  daily_report_id: string;
  lp_number: 1 | 2 | 3;
  submitted: boolean;
  reviewed: boolean;
  approval_rating: number | null; // 1-10
  created_at: string;
}

export interface WESClassUpdate {
  id: string;
  daily_report_id: string;
  time_slot: "16:55" | "17:35" | "18:15";
  class_number: 1 | 2 | 3;
  unit_name: string;
  chapter_name: string;
  learning_outcomes: string;
  what_went_well: string;
  chapters_topics_complete: number;
  summary: string;
  created_at: string;
}

export interface WESAcademicFeedback {
  id: string;
  daily_report_id: string;
  what_is_good: string;
  where_improvement_needed: string;
  rating: number; // 1-10
  signature: string;
  feedback_date: string;
  created_at: string;
}

export interface WESOperationsFeedback {
  id: string;
  daily_report_id: string;
  what_is_good: string;
  where_improvement_needed: string;
  rating: number; // 1-10
  signature: string;
  feedback_date: string;
  created_at: string;
}

export interface WESChallenge {
  id: string;
  weekly_report_id: string;
  challenge_description: string;
  solution_applied: string;
  created_at: string;
}

// Complete report with all related data
export interface WESWeeklyReportComplete extends WESWeeklyReport {
  daily_reports: WESDailyReportComplete[];
  challenges: WESChallenge[];
}

export interface WESDailyReportComplete extends WESDailyReport {
  lesson_plans: WESLessonPlan[];
  class_updates: WESClassUpdate[];
  academic_feedback: WESAcademicFeedback[];
  operations_feedback: WESOperationsFeedback[];
}

// DTOs for creating/updating
export interface CreateWESWeeklyReportDTO {
  teacher_name: string;
  class_batch: string;
  week_start_date: string;
  week_end_date: string;
}

export interface CreateWESDailyReportDTO {
  day_name: "Saturday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  day_date: string;
  my_attendance?: number;
  total_strength?: number;
  progress_tracker_updated?: string;
  parents_called?: number;
  parents_received?: number;
  parent_call_comments?: string;
}

export interface UpdateWESDailyReportDTO {
  my_attendance?: number;
  total_strength?: number;
  progress_tracker_updated?: string;
  parents_called?: number;
  parents_received?: number;
  parent_call_comments?: string;
  class_video_done?: boolean;
  attendance_marked?: boolean;
  tracker_updated?: boolean;
}

export interface CreateWESLessonPlanDTO {
  lp_number: 1 | 2 | 3;
  submitted?: boolean;
  reviewed?: boolean;
  approval_rating?: number;
}

export interface CreateWESClassUpdateDTO {
  time_slot: "16:55" | "17:35" | "18:15";
  class_number: 1 | 2 | 3;
  unit_name?: string;
  chapter_name?: string;
  learning_outcomes?: string;
  what_went_well?: string;
  chapters_topics_complete?: number;
  summary?: string;
}

export interface CreateWESFeedbackDTO {
  what_is_good?: string;
  where_improvement_needed?: string;
  rating?: number;
  signature?: string;
  feedback_date?: string;
}

export interface CreateWESChallengeDTO {
  challenge_description: string;
  solution_applied?: string;
}

// Stats for dashboard
export interface WESReportStats {
  total_reports: number;
  pending_approval: number;
  average_attendance: number;
  average_academic_rating: number;
  average_operations_rating: number;
  total_lesson_plans_submitted: number;
  total_lesson_plans_reviewed: number;
}
