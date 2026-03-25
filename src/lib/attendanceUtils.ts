import { Badge } from "@/components/ui/badge";

export type AttendanceStatus = 
  | "present" 
  | "absent" 
  | "late" 
  | "half_day" 
  | "paid_leave" 
  | "holiday" 
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
  late: {
    label: "Present + Late",
    shortLabel: "PR + LT",
    variant: "outline",
    color: "bg-orange-500",
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
  holiday: {
    label: "Holiday",
    shortLabel: "HO",
    variant: "outline",
    color: "bg-purple-500",
  },
  pending: {
    label: "Pending",
    shortLabel: "PD",
    variant: "secondary",
    color: "bg-gray-500",
  },
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
  // If manually approved/rejected, use that status
  if (status === "approved") {
    if (isLate) return "late";
    return "present";
  }
  if (status === "rejected") return "absent";
  
  // Use calculated status
  if (calculatedStatus === "present") {
    return isLate ? "late" : "present";
  }
  if (calculatedStatus === "absent") return "absent";
  if (calculatedStatus === "half_day") return "half_day";
  if (calculatedStatus === "late") return "late";
  
  return "pending";
}
