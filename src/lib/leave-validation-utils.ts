import { supabase } from "@/integrations/supabase/client";

export interface LeaveRule {
  leave_type: string;
  max_per_request: number;
  max_per_week: number;
  max_per_month: number;
  min_gap_between_requests: number;
  advance_notice_days: number;
}

export interface ValidationError {
  valid: boolean;
  errors: string[];
}

/**
 * Fetch all leave rules from database
 */
export async function fetchLeaveRules(): Promise<LeaveRule[]> {
  try {
    const { data, error } = await supabase
      .from("leave_rules_config")
      .select("*");

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching leave rules:", error);
    return [];
  }
}

/**
 * Get rule for specific leave type
 */
export async function getLeaveTypeRule(leaveType: string): Promise<LeaveRule | null> {
  try {
    // Convert camelCase to snake_case
    const dbLeaveType = leaveType === "halfDay" ? "half_day" : leaveType.toLowerCase();

    const { data, error } = await supabase
      .from("leave_rules_config")
      .select("*")
      .eq("leave_type", dbLeaveType)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error fetching rule for ${leaveType}:`, error);
    return null;
  }
}

/**
 * Validate leave request against rules
 */
export async function validateLeaveRequest(
  userId: string,
  leaveType: string,
  startDate: Date,
  endDate: Date,
  existingLeaves: any[] = []
): Promise<ValidationError> {
  const errors: string[] = [];

  try {
    // Get the rule for this leave type
    const rule = await getLeaveTypeRule(leaveType);
    if (!rule) {
      errors.push(`No rules found for ${leaveType} leave`);
      return { valid: false, errors };
    }

    // Calculate days requested
    const daysRequested = calculateBusinessDays(startDate, endDate);

    // 0. Check advance notice
    if (rule.advance_notice_days > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilLeave = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilLeave < rule.advance_notice_days) {
        errors.push(
          `${leaveType} leave requires ${rule.advance_notice_days} days advance notice. You are applying with only ${daysUntilLeave} days notice.`
        );
      }
    }

    // 1. Check max per request
    if (daysRequested > rule.max_per_request) {
      errors.push(
        `Maximum ${rule.max_per_request} days per request allowed. You requested ${daysRequested} days.`
      );
    }

    // 2. Check max per week
    const weekLeaves = getWeekLeaves(userId, startDate, endDate, existingLeaves, leaveType);
    const weekTotal = weekLeaves + daysRequested;
    if (weekTotal > rule.max_per_week) {
      errors.push(
        `Maximum ${rule.max_per_week} days per week allowed. This would total ${weekTotal} days in the week of ${formatDate(startDate)}.`
      );
    }

    // 3. Check max per year (using rule.max_per_month as the yearly limit)
    const yearLeaves = getYearLeaves(userId, startDate, endDate, existingLeaves, leaveType);
    const yearTotal = yearLeaves + daysRequested;
    if (yearTotal > rule.max_per_month) {
      errors.push(
        `Maximum ${rule.max_per_month} days per year allowed. This would total ${yearTotal} days in the year ${startDate.getFullYear()}.`
      );
    }

    // 4. Check minimum gap between requests
    if (rule.min_gap_between_requests > 0) {
      const gapErrors = checkMinimumGap(userId, startDate, endDate, existingLeaves, leaveType, rule.min_gap_between_requests);
      if (gapErrors) {
        errors.push(...gapErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("Error validating leave request:", error);
    errors.push("Error validating leave request. Please try again.");
    return { valid: false, errors };
  }
}

/**
 * Calculate business days between two dates (excluding weekends)
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get total leaves used in the same week
 */
function getWeekLeaves(
  userId: string,
  startDate: Date,
  endDate: Date,
  existingLeaves: any[],
  leaveType: string
): number {
  const weekStart = getWeekStart(startDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekLeaves = existingLeaves.filter((leave) => {
    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    const sameType = leave.leave_type?.toLowerCase() === leaveType.toLowerCase();
    const approved = leave.status === "approved";
    const overlaps =
      (leaveStart <= weekEnd && leaveEnd >= weekStart);

    return sameType && approved && overlaps;
  });

  let total = 0;
  for (const leave of weekLeaves) {
    total += calculateBusinessDays(new Date(leave.start_date), new Date(leave.end_date));
  }

  return total;
}

/**
 * Get total leaves used in the same year
 */
function getYearLeaves(
  userId: string,
  startDate: Date,
  endDate: Date,
  existingLeaves: any[],
  leaveType: string
): number {
  const yearStart = new Date(startDate.getFullYear(), 0, 1);
  const yearEnd = new Date(startDate.getFullYear(), 11, 31);

  const yearLeaves = existingLeaves.filter((leave) => {
    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    const sameType = leave.leave_type?.toLowerCase() === leaveType.toLowerCase();
    const approved = leave.status === "approved";
    const overlaps =
      (leaveStart <= yearEnd && leaveEnd >= yearStart);

    return sameType && approved && overlaps;
  });

  let total = 0;
  for (const leave of yearLeaves) {
    total += calculateBusinessDays(new Date(leave.start_date), new Date(leave.end_date));
  }

  return total;
}

/**
 * Check minimum gap between leave requests
 */
function checkMinimumGap(
  userId: string,
  startDate: Date,
  endDate: Date,
  existingLeaves: any[],
  leaveType: string,
  minGap: number
): string[] {
  const errors: string[] = [];
  const approved = existingLeaves.filter(
    (leave) =>
      leave.leave_type?.toLowerCase() === leaveType.toLowerCase() &&
      leave.status === "approved"
  );

  for (const leave of approved) {
    const leaveEnd = new Date(leave.end_date);
    const dayAfterLeave = new Date(leaveEnd);
    dayAfterLeave.setDate(dayAfterLeave.getDate() + 1);

    const gapStartDate = new Date(dayAfterLeave);
    const gapEndDate = new Date(dayAfterLeave);
    gapEndDate.setDate(gapEndDate.getDate() + minGap - 1);

    if (startDate <= gapEndDate && startDate >= dayAfterLeave) {
      errors.push(`Minimum ${minGap} days gap required between ${leaveType} leave requests. Your last ${leaveType} leave ended on ${formatDate(leaveEnd)}.`);
    }
  }

  return errors;
}

/**
 * Get the start of week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get month name
 */
function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });
}

/**
 * Get all rules for display
 */
export async function getFormattedRules(): Promise<Map<string, LeaveRule>> {
  const rules = await fetchLeaveRules();
  const map = new Map<string, LeaveRule>();

  for (const rule of rules) {
    map.set(rule.leave_type, rule);
  }

  return map;
}
