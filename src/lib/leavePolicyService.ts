import { supabase } from "@/integrations/supabase/client";

export type LeaveType = "casual" | "medical" | "emergency" | "lop" | "half_day";

export interface LeavePolicyData {
  label: string;
  code: string;
  advanceDays: number;
  maxDaysAtTime: number;
  balance: number;
  salaryImpact: string;
  salaryImpactShort: string;
  proofSubmission: string;
  purpose: string;
}

// Default policies fallback
const DEFAULT_LEAVE_POLICY: Record<LeaveType, LeavePolicyData> = {
  casual: {
    label: "Casual Leave",
    code: "PL",
    advanceDays: 4,
    maxDaysAtTime: 2,
    balance: 6,
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Planned personal work or short planned absence",
  },
  medical: {
    label: "Medical Leave",
    code: "PL",
    advanceDays: 0,
    maxDaysAtTime: 2,
    balance: 6,
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Planned leave earned after qualifying service period",
  },
  emergency: {
    label: "Emergency Leave",
    code: "LE",
    advanceDays: 0,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "After 2 Days",
    purpose: "Sudden unavoidable emergency",
  },
  lop: {
    label: "Leave Without Pay / LOP",
    code: "LE",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Unpaid leave or absence not covered under paid leave",
  },
  half_day: {
    label: "Half-Day Leave",
    code: "HD",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "0.5 LOP",
    salaryImpactShort: "Half day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Leave for half working day",
  },
};

/**
 * Fetch leave policy from leave_balances_config table
 * Falls back to defaults if not found or error occurs
 */
export async function getLeavePolicy(
  leaveType: LeaveType
): Promise<LeavePolicyData> {
  try {
    // Try to get from config table (admin-configured policies)
    const { data, error } = await supabase
      .from("leave_balance_config")
      .select("*")
      .eq("leave_type", leaveType)
      .maybeSingle();

    // If table doesn't exist or no data, just use defaults
    if (error || !data) {
      return DEFAULT_LEAVE_POLICY[leaveType];
    }

    // Map database record to policy format
    return {
      label: DEFAULT_LEAVE_POLICY[leaveType].label,
      code: data.code || DEFAULT_LEAVE_POLICY[leaveType].code,
      advanceDays: data.advance_notice || DEFAULT_LEAVE_POLICY[leaveType].advanceDays,
      maxDaysAtTime: data.max_per_request || DEFAULT_LEAVE_POLICY[leaveType].maxDaysAtTime,
      balance: data.monthly_balance || DEFAULT_LEAVE_POLICY[leaveType].balance,
      salaryImpact: DEFAULT_LEAVE_POLICY[leaveType].salaryImpact,
      salaryImpactShort: `${data.salary_impact_percent || 0}% deduction`,
      proofSubmission: DEFAULT_LEAVE_POLICY[leaveType].proofSubmission,
      purpose: DEFAULT_LEAVE_POLICY[leaveType].purpose,
    };
  } catch (error) {
    console.error(`Error fetching policy for ${leaveType}:`, error);
    return DEFAULT_LEAVE_POLICY[leaveType];
  }
}

/**
 * Get all leave policies from config table
 */
export async function getAllLeavePolicies(): Promise<
  Record<LeaveType, LeavePolicyData>
> {
  try {
    const { data, error } = await supabase
      .from("leave_balance_config")
      .select("*");

    if (error || !data || data.length === 0) {
      return DEFAULT_LEAVE_POLICY;
    }

    const policies: Record<LeaveType, LeavePolicyData> = { ...DEFAULT_LEAVE_POLICY };

    for (const record of data) {
      const leaveType = record.leave_type as LeaveType;
      if (policies[leaveType]) {
        policies[leaveType] = {
          ...DEFAULT_LEAVE_POLICY[leaveType],
          advanceDays: record.advance_notice || DEFAULT_LEAVE_POLICY[leaveType].advanceDays,
          maxDaysAtTime: record.max_per_request || DEFAULT_LEAVE_POLICY[leaveType].maxDaysAtTime,
          balance: record.monthly_balance || DEFAULT_LEAVE_POLICY[leaveType].balance,
          salaryImpactShort: `${record.salary_impact_percent || 0}% deduction`,
        };
      }
    }

    return policies;
  } catch (error) {
    console.error("Error fetching all policies:", error);
    return DEFAULT_LEAVE_POLICY;
  }
}
