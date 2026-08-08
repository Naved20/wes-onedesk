import { supabase } from "@/integrations/supabase/client";
import { getLeaveTypeRule } from "./leave-validation-utils";

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
    advanceDays: 0,
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
    advanceDays: 0,
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
    advanceDays: 0,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "0.5 LOP",
    salaryImpactShort: "Half day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Leave for half working day",
  },
};

/**
 * Fetch leave policy from leave_balance_config table + leave_rules_config
 * Falls back to defaults if not found or error occurs
 */
export async function getLeavePolicy(
  leaveType: LeaveType
): Promise<LeavePolicyData> {
  try {
    // Get balance and salary impact from leave_balance_config
    const { data: policyData, error: policyError } = await supabase
      .from("leave_balance_config")
      .select("*")
      .eq("leave_type", leaveType)
      .maybeSingle();

    // Get rules (advance notice, max per request) from leave_rules_config
    const ruleData = await getLeaveTypeRule(leaveType);

    // If tables don't exist or no data, just use defaults
    if ((policyError && !policyData) || (!ruleData)) {
      return DEFAULT_LEAVE_POLICY[leaveType];
    }

    // Use data from both tables
    const advanceDays = ruleData?.advance_notice_days || DEFAULT_LEAVE_POLICY[leaveType].advanceDays;
    const maxDaysAtTime = ruleData?.max_per_request || DEFAULT_LEAVE_POLICY[leaveType].maxDaysAtTime;
    const balance = policyData?.monthly_balance || DEFAULT_LEAVE_POLICY[leaveType].balance;
    const salaryImpact = policyData?.salary_impact_percent || 0;

    return {
      label: DEFAULT_LEAVE_POLICY[leaveType].label,
      code: DEFAULT_LEAVE_POLICY[leaveType].code,
      advanceDays,
      maxDaysAtTime,
      balance,
      salaryImpact: DEFAULT_LEAVE_POLICY[leaveType].salaryImpact,
      salaryImpactShort: `${salaryImpact}% deduction`,
      proofSubmission: DEFAULT_LEAVE_POLICY[leaveType].proofSubmission,
      purpose: DEFAULT_LEAVE_POLICY[leaveType].purpose,
    };
  } catch (error) {
    console.error(`Error fetching policy for ${leaveType}:`, error);
    return DEFAULT_LEAVE_POLICY[leaveType];
  }
}

/**
 * Get all leave policies from both config tables
 */
export async function getAllLeavePolicies(): Promise<
  Record<LeaveType, LeavePolicyData>
> {
  try {
    const { data: policyData, error: policyError } = await supabase
      .from("leave_balance_config")
      .select("*");

    const policies: Record<LeaveType, LeavePolicyData> = { ...DEFAULT_LEAVE_POLICY };

    if (policyError || !policyData || policyData.length === 0) {
      return policies;
    }

    for (const record of policyData) {
      const leaveType = record.leave_type as LeaveType;
      
      // Get rules from leave_rules_config
      const ruleData = await getLeaveTypeRule(leaveType);
      
      if (policies[leaveType]) {
        const advanceDays = ruleData?.advance_notice_days || DEFAULT_LEAVE_POLICY[leaveType].advanceDays;
        const maxDaysAtTime = ruleData?.max_per_request || DEFAULT_LEAVE_POLICY[leaveType].maxDaysAtTime;
        
        policies[leaveType] = {
          ...DEFAULT_LEAVE_POLICY[leaveType],
          advanceDays,
          maxDaysAtTime,
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
