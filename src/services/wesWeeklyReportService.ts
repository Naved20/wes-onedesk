import { supabase } from "@/integrations/supabase/client";
import {
  WESWeeklyReport,
  WESDailyReport,
  WESLessonPlan,
  WESClassUpdate,
  WESAcademicFeedback,
  WESOperationsFeedback,
  WESChallenge,
  WESWeeklyReportComplete,
  WESDailyReportComplete,
  CreateWESWeeklyReportDTO,
  CreateWESDailyReportDTO,
  UpdateWESDailyReportDTO,
  CreateWESLessonPlanDTO,
  CreateWESClassUpdateDTO,
  CreateWESFeedbackDTO,
  CreateWESChallengeDTO,
  WESReportStats,
} from "@/types/wesWeeklyReport";

export const wesWeeklyReportService = {
  // ==================== WEEKLY REPORT CRUD ====================
  
  async createWeeklyReport(
    teacherId: string,
    dto: CreateWESWeeklyReportDTO
  ): Promise<WESWeeklyReport> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .insert({
        teacher_id: teacherId,
        ...dto,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getWeeklyReport(reportId: string): Promise<WESWeeklyReportComplete> {
    const { data: report, error } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error) throw error;

    // Get daily reports
    const { data: dailyReports } = await supabase
      .from("wes_daily_reports")
      .select("*")
      .eq("weekly_report_id", reportId)
      .order("day_date", { ascending: true });

    // Get challenges
    const { data: challenges } = await supabase
      .from("wes_challenges")
      .select("*")
      .eq("weekly_report_id", reportId);

    // For each daily report, get related data
    const dailyReportsComplete: WESDailyReportComplete[] = await Promise.all(
      (dailyReports || []).map(async (daily) => {
        const [lessonPlans, classUpdates, academicFeedback, operationsFeedback] =
          await Promise.all([
            supabase
              .from("wes_lesson_plans")
              .select("*")
              .eq("daily_report_id", daily.id)
              .order("lp_number"),
            supabase
              .from("wes_class_updates")
              .select("*")
              .eq("daily_report_id", daily.id)
              .order("class_number"),
            supabase
              .from("wes_academic_feedback")
              .select("*")
              .eq("daily_report_id", daily.id),
            supabase
              .from("wes_operations_feedback")
              .select("*")
              .eq("daily_report_id", daily.id),
          ]);

        return {
          ...daily,
          lesson_plans: lessonPlans.data || [],
          class_updates: classUpdates.data || [],
          academic_feedback: academicFeedback.data || [],
          operations_feedback: operationsFeedback.data || [],
        };
      })
    );

    return {
      ...report,
      daily_reports: dailyReportsComplete,
      challenges: challenges || [],
    };
  },

  async getTeacherWeeklyReports(teacherId: string): Promise<WESWeeklyReport[]> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("week_start_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async submitWeeklyReport(reportId: string): Promise<WESWeeklyReport> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateWeeklyReportStatus(
    reportId: string,
    status: "approved" | "rejected"
  ): Promise<WESWeeklyReport> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .update({ status })
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteWeeklyReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from("wes_weekly_reports")
      .delete()
      .eq("id", reportId)
      .eq("status", "draft");

    if (error) throw error;
  },

  // ==================== DAILY REPORT CRUD ====================
  
  async createDailyReport(
    weeklyReportId: string,
    dto: CreateWESDailyReportDTO
  ): Promise<WESDailyReport> {
    const { data, error } = await supabase
      .from("wes_daily_reports")
      .insert({
        weekly_report_id: weeklyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateDailyReport(
    dailyReportId: string,
    dto: UpdateWESDailyReportDTO
  ): Promise<WESDailyReport> {
    const { data, error } = await supabase
      .from("wes_daily_reports")
      .update(dto)
      .eq("id", dailyReportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== LESSON PLANS CRUD ====================

  async createLessonPlan(
    dailyReportId: string,
    dto: CreateWESLessonPlanDTO
  ): Promise<WESLessonPlan> {
    const { data, error } = await supabase
      .from("wes_lesson_plans")
      .insert({
        daily_report_id: dailyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLessonPlan(
    lessonPlanId: string,
    dto: Partial<CreateWESLessonPlanDTO>
  ): Promise<WESLessonPlan> {
    const { data, error } = await supabase
      .from("wes_lesson_plans")
      .update(dto)
      .eq("id", lessonPlanId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== CLASS UPDATES CRUD ====================
  
  async createClassUpdate(
    dailyReportId: string,
    dto: CreateWESClassUpdateDTO
  ): Promise<WESClassUpdate> {
    const { data, error } = await supabase
      .from("wes_class_updates")
      .insert({
        daily_report_id: dailyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateClassUpdate(
    classUpdateId: string,
    dto: Partial<CreateWESClassUpdateDTO>
  ): Promise<WESClassUpdate> {
    const { data, error } = await supabase
      .from("wes_class_updates")
      .update(dto)
      .eq("id", classUpdateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== FEEDBACK CRUD ====================
  
  async createAcademicFeedback(
    dailyReportId: string,
    dto: CreateWESFeedbackDTO
  ): Promise<WESAcademicFeedback> {
    const { data, error } = await supabase
      .from("wes_academic_feedback")
      .insert({
        daily_report_id: dailyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createOperationsFeedback(
    dailyReportId: string,
    dto: CreateWESFeedbackDTO
  ): Promise<WESOperationsFeedback> {
    const { data, error } = await supabase
      .from("wes_operations_feedback")
      .insert({
        daily_report_id: dailyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==================== CHALLENGES CRUD ====================
  
  async createChallenge(
    weeklyReportId: string,
    dto: CreateWESChallengeDTO
  ): Promise<WESChallenge> {
    const { data, error } = await supabase
      .from("wes_challenges")
      .insert({
        weekly_report_id: weeklyReportId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChallenge(
    challengeId: string,
    dto: Partial<CreateWESChallengeDTO>
  ): Promise<WESChallenge> {
    const { data, error } = await supabase
      .from("wes_challenges")
      .update(dto)
      .eq("id", challengeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteChallenge(challengeId: string): Promise<void> {
    const { error } = await supabase
      .from("wes_challenges")
      .delete()
      .eq("id", challengeId);

    if (error) throw error;
  },

  // ==================== STATS & ANALYTICS ====================
  
  async calculateReportStats(reportId: string): Promise<void> {
    // Get all daily reports for this week
    const { data: dailyReports } = await supabase
      .from("wes_daily_reports")
      .select("*, wes_lesson_plans(*), wes_academic_feedback(*), wes_operations_feedback(*)")
      .eq("weekly_report_id", reportId);

    if (!dailyReports) return;

    // Calculate attendance percentage
    const totalAttendance = dailyReports.reduce(
      (sum, d) => sum + (d.my_attendance || 0),
      0
    );
    const totalStrength = dailyReports.reduce(
      (sum, d) => sum + (d.total_strength || 0),
      0
    );
    const attendancePercentage =
      totalStrength > 0 ? (totalAttendance / totalStrength) * 100 : 0;

    // Calculate lesson plan stats
    const allLessonPlans = dailyReports.flatMap((d: any) => d.wes_lesson_plans || []);
    const submittedCount = allLessonPlans.filter((lp: any) => lp.submitted).length;
    const reviewedCount = allLessonPlans.filter((lp: any) => lp.reviewed).length;

    // Calculate average ratings
    const academicFeedbacks = dailyReports.flatMap(
      (d: any) => d.wes_academic_feedback || []
    );
    const operationsFeedbacks = dailyReports.flatMap(
      (d: any) => d.wes_operations_feedback || []
    );

    const avgAcademicRating =
      academicFeedbacks.length > 0
        ? academicFeedbacks.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) /
          academicFeedbacks.length
        : 0;

    const avgOperationsRating =
      operationsFeedbacks.length > 0
        ? operationsFeedbacks.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) /
          operationsFeedbacks.length
        : 0;

    // Update weekly report with calculated stats
    await supabase
      .from("wes_weekly_reports")
      .update({
        total_attendance_percentage: attendancePercentage,
        total_lesson_plans_submitted: submittedCount,
        total_lesson_plans_reviewed: reviewedCount,
        average_academic_rating: avgAcademicRating,
        average_operations_rating: avgOperationsRating,
      })
      .eq("id", reportId);
  },

  async getTeacherStats(teacherId: string): Promise<WESReportStats> {
    const { data: reports } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .eq("teacher_id", teacherId);

    if (!reports || reports.length === 0) {
      return {
        total_reports: 0,
        pending_approval: 0,
        average_attendance: 0,
        average_academic_rating: 0,
        average_operations_rating: 0,
        total_lesson_plans_submitted: 0,
        total_lesson_plans_reviewed: 0,
      };
    }

    return {
      total_reports: reports.length,
      pending_approval: reports.filter((r) => r.status === "submitted").length,
      average_attendance:
        reports.reduce((sum, r) => sum + (r.total_attendance_percentage || 0), 0) /
        reports.length,
      average_academic_rating:
        reports.reduce((sum, r) => sum + (r.average_academic_rating || 0), 0) /
        reports.length,
      average_operations_rating:
        reports.reduce((sum, r) => sum + (r.average_operations_rating || 0), 0) /
        reports.length,
      total_lesson_plans_submitted: reports.reduce(
        (sum, r) => sum + (r.total_lesson_plans_submitted || 0),
        0
      ),
      total_lesson_plans_reviewed: reports.reduce(
        (sum, r) => sum + (r.total_lesson_plans_reviewed || 0),
        0
      ),
    };
  },

  // ==================== BULK OPERATIONS ====================
  
  async createWeekWithDailyReports(
    teacherId: string,
    teacherName: string,
    classBatch: string,
    weekStartDate: string
  ): Promise<string> {
    // Create weekly report
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const { data: weeklyReport, error: weeklyError } = await supabase
      .from("wes_weekly_reports")
      .insert({
        teacher_id: teacherId,
        teacher_name: teacherName,
        class_batch: classBatch,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate.toISOString().split("T")[0],
        status: "draft",
      })
      .select()
      .single();

    if (weeklyError) throw weeklyError;

    // Create 6 daily reports (Sat-Fri)
    const days = ["Saturday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const dailyReportsData = days.map((day, index) => {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + index);

      return {
        weekly_report_id: weeklyReport.id,
        day_name: day,
        day_date: dayDate.toISOString().split("T")[0],
      };
    });

    const { data: dailyReports, error: dailyError } = await supabase
      .from("wes_daily_reports")
      .insert(dailyReportsData)
      .select();

    if (dailyError) throw dailyError;

    // For each daily report, create 3 lesson plans and 3 class updates
    for (const daily of dailyReports || []) {
      // Create 3 lesson plans
      const lessonPlansData = [1, 2, 3].map((num) => ({
        daily_report_id: daily.id,
        lp_number: num,
      }));

      await supabase.from("wes_lesson_plans").insert(lessonPlansData);

      // Create 3 class updates
      const classUpdatesData = [
        { time_slot: "16:55", class_number: 1 },
        { time_slot: "17:35", class_number: 2 },
        { time_slot: "18:15", class_number: 3 },
      ].map((data) => ({
        daily_report_id: daily.id,
        ...data,
      }));

      await supabase.from("wes_class_updates").insert(classUpdatesData);
    }

    return weeklyReport.id;
  },

  // ==================== ADMIN METHODS ====================
  
  async getAllWeeklyReports(): Promise<WESWeeklyReport[]> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .order("week_start_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAllWeeklyReportsWithEmployeeDetails(): Promise<(WESWeeklyReport & { employee_profile?: any })[]> {
    // First get all weekly reports
    const { data: reports, error: reportsError } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .order("week_start_date", { ascending: false });

    if (reportsError) throw reportsError;
    
    if (!reports || reports.length === 0) return [];

    // Get all unique teacher IDs
    const teacherIds = [...new Set(reports.map(r => r.teacher_id))];
    
    // Fetch all employee profiles for these teacher IDs
    const { data: profiles, error: profilesError } = await supabase
      .from("employee_profiles")
      .select("*")
      .in("user_id", teacherIds);

    if (profilesError) throw profilesError;

    // Create a map of user_id -> profile for quick lookup
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });
    }

    // Merge reports with their employee profiles
    return reports.map(report => ({
      ...report,
      employee_profile: profileMap.get(report.teacher_id) || null,
    }));
  },

  async getOrganizationStats(): Promise<{
    total_reports: number;
    total_teachers: number;
    pending_approval: number;
    average_attendance: number;
    total_lesson_plans_submitted: number;
    status_distribution: Record<string, number>;
  }> {
    const { data: reports } = await supabase
      .from("wes_weekly_reports")
      .select("*");

    if (!reports || reports.length === 0) {
      return {
        total_reports: 0,
        total_teachers: 0,
        pending_approval: 0,
        average_attendance: 0,
        total_lesson_plans_submitted: 0,
        status_distribution: {},
      };
    }

    // Count unique teachers
    const uniqueTeacherIds = new Set(reports.map(r => r.teacher_id));
    
    // Count by status
    const statusDistribution: Record<string, number> = {};
    reports.forEach(report => {
      statusDistribution[report.status] = (statusDistribution[report.status] || 0) + 1;
    });

    return {
      total_reports: reports.length,
      total_teachers: uniqueTeacherIds.size,
      pending_approval: reports.filter(r => r.status === "submitted").length,
      average_attendance:
        reports.reduce((sum, r) => sum + (r.total_attendance_percentage || 0), 0) /
        reports.length,
      total_lesson_plans_submitted: reports.reduce(
        (sum, r) => sum + (r.total_lesson_plans_submitted || 0),
        0
      ),
      status_distribution: statusDistribution,
    };
  },

  async searchReports(query: string): Promise<WESWeeklyReport[]> {
    const { data, error } = await supabase
      .from("wes_weekly_reports")
      .select("*")
      .or(`teacher_name.ilike.%${query}%,class_batch.ilike.%${query}%`)
      .order("week_start_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },
};