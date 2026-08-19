import { Badge } from "@/components/ui/badge";

export type AttendanceStatus = 
  | "present" 
  | "absent" 
  | "half_day" 
  | "paid_leave" 
  | "leave"
  | "holiday" 
  | "not_applicable"
  | "pending";

export interface AttendanceStatusConfig {
  label: string;
  shortLabel: string;
  variant: "default" | "destructive" | "secondary" | "outline";
  color: string;
}

export const attendanceStatusConfig: Record<AttendanceStatus, AttendanceStatusConfig> = {
  present: {
    label: "Present",
    shortLabel: "PR",
    variant: "default",
    color: "bg-green-500",
  },
  absent: {
    label: "Absent",
    shortLabel: "AB",
    variant: "destructive",
    color: "bg-red-500",
  },
  half_day: {
    label: "Half Day",
    shortLabel: "HD",
    variant: "secondary",
    color: "bg-yellow-500",
  },
  paid_leave: {
    label: "Paid Leave",
    shortLabel: "PL",
    variant: "secondary",
    color: "bg-blue-500",
  },
  leave: {
    label: "Leave",
    shortLabel: "LE",
    variant: "secondary",
    color: "bg-cyan-500",
  },
  holiday: {
    label: "Holiday",
    shortLabel: "HO",
    variant: "outline",
    color: "bg-purple-500",
  },
  not_applicable: {
    label: "Not Applicable",
    shortLabel: "NA",
    variant: "outline",
    color: "bg-gray-400",
  },
  pending: {
    label: "Pending",
    shortLabel: "PD",
    variant: "secondary",
    color: "bg-gray-500",
  },
};

export const lateStatusConfig = {
  label: "Late",
  shortLabel: "LT",
  variant: "outline" as const,
  color: "bg-orange-500",
};

export function getAttendanceStatusBadge(status: string | null, useShortLabel = false) {
  const normalizedStatus = (status?.toLowerCase() || "pending") as AttendanceStatus;
  const config = attendanceStatusConfig[normalizedStatus] || attendanceStatusConfig.pending;
  
  return {
    label: useShortLabel ? config.shortLabel : config.label,
    variant: config.variant,
    color: config.color,
  };
}

export function getAttendanceDisplayStatus(
  status: string | null,
  calculatedStatus: string | null,
  isLate: boolean | null
): AttendanceStatus {
  const calc = calculatedStatus?.toLowerCase() ?? null;
  const stat = status?.toLowerCase() ?? null;

  if (calc === "not_applicable" || calc === "na") return "not_applicable";
  if (calc === "paid_leave") return "paid_leave";
  if (calc === "leave") return "leave";
  if (calc === "half_day") return "half_day";
  if (calc === "holiday" || stat === "holiday") return "holiday";
  if (calc === "absent" || stat === "rejected") return "absent";
  if (calc === "present" || calc === "late") return "present";

  // Generic approved status defaults to present if not a leave/holiday/absent
  if (stat === "approved") {
    return "present";
  }

  return "pending";
}
