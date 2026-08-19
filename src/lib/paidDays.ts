/**
 * Single source of truth for attendance -> paid days math.
 *
 * Mirrors the database function `calculate_attendance_stats` exactly so that
 * the Attendance page, Salary page, Payslip and the Employee view all show
 * the same numbers.
 */

export type EffectiveStatus =
  | "present"
  | "late"
  | "half_day"
  | "paid_leave"
  | "leave"
  | "absent"
  | "holiday"
  | "not_applicable"
  | "pending";

export interface AttendanceLikeRecord {
  status?: string | null;
  calculated_status?: string | null;
  is_half_day?: boolean | null;
  is_late?: boolean | null;
  check_in_time?: string | null;
}

/** Same CASE ladder as public.attendance_effective_status() in the database. */
export function getEffectiveStatus(record: AttendanceLikeRecord): EffectiveStatus {
  const status = record.status?.toLowerCase() ?? null;
  const calc = record.calculated_status?.toLowerCase() ?? null;

  if (calc === "not_applicable" || calc === "na") return "not_applicable";
  if (calc === "paid_leave") return "paid_leave";
  if (calc === "leave") return "leave";
  if (calc === "half_day" || record.is_half_day) return "half_day";
  if (calc === "late" || record.is_late) return "late";
  if (status === "holiday" || calc === "holiday") return "holiday";
  if (status === "rejected" || calc === "absent") return "absent";
  if (calc === "present" || record.check_in_time || status === "approved" || status === "present") {
    return "present";
  }
  return "pending";
}

export interface PaidDaysInput {
  /** present days INCLUDING late days, counted once */
  present_days: number;
  holiday_count: number;
  half_days: number;
  paid_leave_days: number;
  late_days: number;
  absent_days: number;
}

/** Late sets: every 3 late marks costs 1 paid day. */
export function getLateSets(lateDays: number): number {
  return Math.floor((lateDays || 0) / 3);
}

/** Total Paid Days = PR + HO + (HD × 0.5) + PL − Late Sets − AB */
export function getPaidDays(input: Partial<PaidDaysInput>): number {
  const present = input.present_days || 0;
  const holiday = input.holiday_count || 0;
  const half = input.half_days || 0;
  const paidLeave = input.paid_leave_days || 0;
  const absent = input.absent_days || 0;
  const lateSets = getLateSets(input.late_days || 0);

  return Math.max(0, present + holiday + half * 0.5 + paidLeave - lateSets - absent);
}

/** Human readable breakdown, used under the "Total Paid Days" figure. */
export function getPaidDaysFormula(input: Partial<PaidDaysInput>): string {
  const lateSets = getLateSets(input.late_days || 0);
  return `PR (${input.present_days || 0}) + HO (${input.holiday_count || 0}) + HD (${(
    (input.half_days || 0) * 0.5
  ).toFixed(1)}) + PL (${input.paid_leave_days || 0}) - Late Sets (${lateSets}) - AB (${
    input.absent_days || 0
  })`;
}

export interface AttendanceSummary extends PaidDaysInput {
  payroll_days: number;
  present_on_time: number;
  late_sets: number;
  leave_days: number;
  pending_days: number;
  rejected_days: number;
  total_paid_days: number;
  attendance_percentage: number;
}

/** Number of calendar days in a month (payroll days definition used everywhere). */
export function getPayrollDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Client-side equivalent of the calculate_attendance_stats RPC. */
export function summarizeAttendance(
  records: AttendanceLikeRecord[],
  year: number,
  month: number
): AttendanceSummary {
  const counts: Record<EffectiveStatus, number> = {
    present: 0,
    late: 0,
    half_day: 0,
    paid_leave: 0,
    leave: 0,
    absent: 0,
    holiday: 0,
    not_applicable: 0,
    pending: 0,
  };
  let rejected = 0;

  for (const record of records) {
    counts[getEffectiveStatus(record)] += 1;
    if (record.status?.toLowerCase() === "rejected") rejected += 1;
  }

  const payrollDays = getPayrollDays(year, month);
  const base: PaidDaysInput = {
    present_days: counts.present + counts.late,
    holiday_count: counts.holiday,
    half_days: counts.half_day,
    paid_leave_days: counts.paid_leave,
    late_days: counts.late,
    absent_days: counts.absent,
  };
  const totalPaid = getPaidDays(base);

  return {
    ...base,
    payroll_days: payrollDays,
    present_on_time: counts.present,
    late_sets: getLateSets(counts.late),
    leave_days: counts.leave,
    pending_days: counts.pending,
    rejected_days: rejected,
    total_paid_days: Number(totalPaid.toFixed(1)),
    attendance_percentage:
      payrollDays > 0 ? Number(Math.min((totalPaid / payrollDays) * 100, 100).toFixed(1)) : 0,
  };
}
