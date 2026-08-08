import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

interface ResetRequest {
  trigger_type: "manual" | "scheduled";
  frequency?: string;
  carryForwardEnabled?: boolean;
  maxCarryForward?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Create Supabase client with admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || userRole?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can reset balances" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const body = (await req.json()) as ResetRequest;

    // Get all active employees
    const { data: employees, error: employeesError } = await supabase
      .from("employee_profiles")
      .select("user_id")
      .eq("is_active", true);

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          employees_affected: 0,
          message: "No active employees to reset",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let totalLeavesCarriedForward = 0;
    const resetPromises = [];
    const notificationPromises = [];
    let successCount = 0;
    let failureCount = 0;

    // For each employee
    for (const employee of employees) {
      try {
        // Get previous month balance
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const { data: previousBalance } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("user_id", employee.user_id)
          .eq("month", previousMonth)
          .eq("year", previousYear)
          .single();

        // Calculate unused leaves from previous period
        let carryForwardAmount = 0;
        if (body.carryForwardEnabled && previousBalance) {
          const casualUsed = previousBalance.casual_leaves_used || 0;
          const casualEntitled = previousBalance.casual_leaves_entitled || 0;
          const casualRemaining = Math.max(0, casualEntitled - casualUsed);

          const medicalUsed = previousBalance.medical_leaves_used || 0;
          const medicalEntitled = previousBalance.medical_leaves_entitled || 0;
          const medicalRemaining = Math.max(0, medicalEntitled - medicalUsed);

          // Calculate carry forward (up to maxCarryForward)
          carryForwardAmount = Math.min(
            casualRemaining + medicalRemaining,
            body.maxCarryForward || 999
          );

          totalLeavesCarriedForward += carryForwardAmount;
        }

        // Check if current month balance exists
        const { data: currentBalance, error: currentError } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("user_id", employee.user_id)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .single();

        if (currentError?.code === "PGRST116") {
          // No record exists, create one
          resetPromises.push(
            supabase.from("leave_balances").insert({
              user_id: employee.user_id,
              month: currentMonth,
              year: currentYear,
              casual_leaves_used: 0,
              medical_leaves_used: 0,
              emergency_leaves_used: 0,
              lop_leaves_used: 0,
              half_day_leaves_used: carryForwardAmount > 0 ? carryForwardAmount : 0,
              casual_leaves_entitled: 6,
              medical_leaves_entitled: 6,
              emergency_leaves_entitled: 6,
              lop_leaves_entitled: 6,
            })
          );
        } else if (currentBalance) {
          // Update existing record - reset used, keep entitled
          resetPromises.push(
            supabase
              .from("leave_balances")
              .update({
                casual_leaves_used: 0,
                medical_leaves_used: 0,
                emergency_leaves_used: 0,
                lop_leaves_used: 0,
                half_day_leaves_used: carryForwardAmount > 0 ? carryForwardAmount : 0,
              })
              .eq("id", currentBalance.id)
          );
        }

        // Create notification for this employee
        const notificationMessage = `Your leave balance has been reset for ${getMonthName(currentMonth)}. ${carryForwardAmount > 0 ? `${carryForwardAmount} days carried forward.` : ""}`;
        notificationPromises.push(
          supabase.from("notifications").insert({
            user_id: employee.user_id,
            title: "Leave Balance Reset",
            message: notificationMessage,
            type: "leave_reset",
            read: false,
            created_at: now.toISOString(),
          }).catch(err => console.error(`Failed to create notification for ${employee.user_id}:`, err))
        );

        successCount++;
      } catch (error) {
        console.error(`Error processing employee ${employee.user_id}:`, error);
        failureCount++;
      }
    }

    // Execute all reset operations
    await Promise.all(resetPromises).catch(err => {
      console.error("Error executing reset operations:", err);
      throw new Error(`Failed to reset balances: ${err.message}`);
    });

    // Send all notifications
    await Promise.allSettled(notificationPromises);

    // Update leave_reset_settings with next reset date
    const { data: settings } = await supabase
      .from("leave_reset_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    if (settings) {
      let nextResetDate = calculateNextResetDate(settings);

      await supabase
        .from("leave_reset_settings")
        .update({
          last_reset_date: now.toISOString(),
          next_reset_date: nextResetDate.toISOString(),
        })
        .eq("id", settings.id);
    }

    // Log to history
    await supabase.from("leave_reset_history").insert({
      reset_date: now.toISOString(),
      frequency: body.frequency || "manual",
      employees_affected: employees.length,
      leaves_carried_forward: totalLeavesCarriedForward,
      status: "completed",
    });

    // Send notification to all employees
    const { data: allUsers } = await supabase
      .from("employee_profiles")
      .select("user_id")
      .in(
        "user_id",
        employees.map((e) => e.user_id)
      );

    if (allUsers && allUsers.length > 0) {
      // Notifications already sent via notificationPromises above
      console.log(`Notifications sent to ${allUsers.length} employees`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        employees_affected: employees.length,
        leaves_carried_forward: totalLeavesCarriedForward,
        reset_date: now.toISOString(),
        message: `Successfully reset balances for ${employees.length} employees`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in reset-leave-balances:", error);

    // Log error to history
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from("leave_reset_history").insert({
        reset_date: new Date().toISOString(),
        frequency: "manual",
        employees_affected: 0,
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      });
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Helper function to get month name
function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || `Month ${month}`;
}

// Helper function to calculate next reset date
function calculateNextResetDate(settings: any): Date {
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
      const quarterMonths = [1, 4, 7, 10];
      const currentQuarter = Math.floor(today.getMonth() / 3);
      let nextQuarterMonth = quarterMonths[currentQuarter];
      let nextYear = today.getFullYear();

      if (today.getMonth() > nextQuarterMonth || (today.getMonth() === nextQuarterMonth && today.getDate() >= (settings.reset_day || 1))) {
        const nextQuarterIndex = (currentQuarter + 1) % 4;
        nextQuarterMonth = quarterMonths[nextQuarterIndex];
        nextYear += nextQuarterIndex === 0 ? 1 : 0;
      }

      nextDate = new Date(nextYear, nextQuarterMonth, settings.reset_day || 1);
      break;

    case "half_yearly":
      const halfYearlyMonths = [settings.reset_month || 1, (settings.reset_month || 1) + 6];
      const currentHalfYear = today.getMonth() < 6 ? 0 : 1;
      let nextHalfMonth = halfYearlyMonths[currentHalfYear];
      let nextHalfYear = today.getFullYear();

      if (today.getMonth() > nextHalfMonth - 1 || (today.getMonth() === nextHalfMonth - 1 && today.getDate() >= (settings.reset_day || 1))) {
        nextHalfMonth = halfYearlyMonths[1 - currentHalfYear];
        nextHalfYear += currentHalfYear === 0 ? 0 : 1;
      }

      nextDate = new Date(nextHalfYear, nextHalfMonth - 1, settings.reset_day || 1);
      break;

    case "yearly":
      nextDate = new Date(today.getFullYear(), (settings.reset_month || 1) - 1, settings.reset_day || 1);
      if (nextDate <= today) {
        nextDate = new Date(today.getFullYear() + 1, (settings.reset_month || 1) - 1, settings.reset_day || 1);
      }
      break;

    default:
      nextDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  }

  return nextDate;
}
