import { supabase } from "@/integrations/supabase/client";

interface EmployeeBalance {
  user_id: string;
  casual_leaves_used: number;
  casual_leaves_entitled: number;
  medical_leaves_used: number;
  medical_leaves_entitled: number;
  emergency_leaves_used: number;
  emergency_leaves_entitled: number;
  lop_leaves_used: number;
  lop_leaves_entitled: number;
  half_day_leaves_used: number;
  half_day_leaves_entitled: number;
}

/**
 * Calculate carry forward leaves for an employee
 * Carries forward unused paid leaves (casual + medical)
 */
export function calculateCarryForward(
  balance: EmployeeBalance,
  maxCarryForward: number
): number {
  // Calculate unused casual leaves
  const casualRemaining = Math.max(0, balance.casual_leaves_entitled - balance.casual_leaves_used);

  // Calculate unused medical leaves
  const medicalRemaining = Math.max(0, balance.medical_leaves_entitled - balance.medical_leaves_used);

  // Total unused paid leaves
  const totalUnused = casualRemaining + medicalRemaining;

  // Apply max carry forward limit (0 = unlimited)
  if (maxCarryForward === 0) {
    return totalUnused;
  }

  return Math.min(totalUnused, maxCarryForward);
}

/**
 * Reset single employee's balance
 */
export async function resetEmployeeBalance(
  userId: string,
  currentMonth: number,
  currentYear: number,
  carryForwardAmount: number = 0
): Promise<boolean> {
  try {
    // Check if balance record exists for current year
    const { data: existingBalance, error: checkError } = await supabase
      .from("leave_balances")
      .select("id")
      .eq("user_id", userId)
      .eq("year", currentYear)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const updateData = {
      casual_leaves_used: 0,
      medical_leaves_used: 0,
      emergency_leaves_used: 0,
      lop_leaves_used: 0,
      half_day_leaves_used: carryForwardAmount,
    };

    if (existingBalance) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("leave_balances")
        .update(updateData)
        .eq("id", existingBalance.id);

      if (updateError) throw updateError;
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from("leave_balances")
        .insert({
          user_id: userId,
          month: 1, // Default month
          year: currentYear,
          ...updateData,
          casual_leaves_entitled: 6,
          medical_leaves_entitled: 6,
          emergency_leaves_entitled: 6,
          lop_leaves_entitled: 6,
          half_day_leaves_entitled: 6,
        });

      if (insertError) throw insertError;
    }

    return true;
  } catch (error) {
    console.error(`Error resetting balance for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get carry forward history for audit trail
 */
export async function getCarryForwardHistory(
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  try {
    let query = supabase.from("leave_reset_history").select("*");

    if (startDate) {
      query = query.gte("reset_date", startDate);
    }

    if (endDate) {
      query = query.lte("reset_date", endDate);
    }

    const { data, error } = await query.order("reset_date", { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error fetching carry forward history:", error);
    return [];
  }
}

/**
 * Calculate next reset date based on settings
 */
export function calculateNextResetDate(settings: any): Date {
  const today = new Date();
  let nextDate = new Date();

  switch (settings.reset_frequency) {
    case "monthly":
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, settings.reset_day || 1);
      if (nextDate <= today) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 2, settings.reset_day || 1);
      }
      break;

    case "quarterly":
      const quarterMonths = [0, 3, 6, 9];
      const currentQuarter = Math.floor(today.getMonth() / 3);
      let nextQuarterMonthIndex = currentQuarter;
      let nextYear = today.getFullYear();

      const nextQuarterMonth = quarterMonths[nextQuarterMonthIndex];
      nextDate = new Date(nextYear, nextQuarterMonth, settings.reset_day || 1);

      if (nextDate <= today) {
        nextQuarterMonthIndex = (currentQuarter + 1) % 4;
        nextYear += nextQuarterMonthIndex === 0 ? 1 : 0;
        nextDate = new Date(nextYear, quarterMonths[nextQuarterMonthIndex], settings.reset_day || 1);
      }
      break;

    case "half_yearly":
      const firstHalfMonth = (settings.reset_month || 1) - 1;
      const secondHalfMonth = firstHalfMonth + 6;
      const currentMonthIndex = today.getMonth();

      let targetMonth = firstHalfMonth;
      let targetYear = today.getFullYear();

      if (currentMonthIndex >= secondHalfMonth) {
        targetMonth = firstHalfMonth;
        targetYear = today.getFullYear() + 1;
      } else if (currentMonthIndex >= firstHalfMonth) {
        targetMonth = secondHalfMonth;
      }

      nextDate = new Date(targetYear, targetMonth, settings.reset_day || 1);

      if (nextDate <= today) {
        nextDate = new Date(targetYear + 1, firstHalfMonth, settings.reset_day || 1);
      }
      break;

    case "yearly":
      const yearMonthIndex = (settings.reset_month || 1) - 1;
      nextDate = new Date(today.getFullYear(), yearMonthIndex, settings.reset_day || 1);

      if (nextDate <= today) {
        nextDate = new Date(today.getFullYear() + 1, yearMonthIndex, settings.reset_day || 1);
      }
      break;

    default:
      nextDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  }

  return nextDate;
}

/**
 * Validate reset settings
 */
export function validateResetSettings(settings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!settings.reset_frequency) {
    errors.push("Reset frequency is required");
  }

  if (!["monthly", "quarterly", "half_yearly", "yearly", "never"].includes(settings.reset_frequency)) {
    errors.push("Invalid reset frequency");
  }

  if (settings.reset_frequency !== "never") {
    if (settings.reset_day < 1 || settings.reset_day > 31) {
      errors.push("Reset day must be between 1 and 31");
    }

    if (settings.reset_frequency !== "monthly" && (settings.reset_month < 1 || settings.reset_month > 12)) {
      errors.push("Reset month must be between 1 and 12");
    }
  }

  if (settings.carry_forward_enabled) {
    if (settings.max_carry_forward < 0) {
      errors.push("Maximum carry forward must be non-negative");
    }

    if (settings.carry_forward_expiry < 1) {
      errors.push("Carry forward expiry must be at least 1 day");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
