import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  value: number;
  medal?: string;
}

export interface LeaderboardData {
  [key: string]: LeaderboardEntry[];
}

// Get top 5 users by tasks completed
export const getTasksCompletedLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const { data: responses, error } = await supabase
      .from("task_responses")
      .select("user_id");

    if (error) {
      console.error("Error fetching task responses:", error);
      return [];
    }

    if (!responses || responses.length === 0) {
      console.log("No task responses found");
      return [];
    }

    // Get employee profiles for names
    const userIds = Array.from(new Set((responses || []).map(r => r.user_id)));
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
    });

    // Count tasks per user
    const taskCounts: Record<string, number> = {};
    (responses || []).forEach(response => {
      taskCounts[response.user_id] = (taskCounts[response.user_id] || 0) + 1;
    });

    // Convert to leaderboard format and sort
    const leaderboard = Object.entries(taskCounts)
      .map(([userId, count]) => {
        const emp = employeeMap[userId];
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: count,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Tasks completed leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching tasks completed leaderboard:", error);
    return [];
  }
};

// Get top 5 users by reviews completed
export const getReviewsCompletedLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const { data: remarks, error } = await supabase
      .from("task_remarks")
      .select("remarked_by");

    if (error) {
      console.error("Error fetching task remarks:", error);
      return [];
    }

    if (!remarks || remarks.length === 0) {
      console.log("No task remarks found");
      return [];
    }

    // Get employee profiles for names
    const reviewerIds = Array.from(new Set((remarks || []).map(r => r.remarked_by)));
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", reviewerIds);

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
    });

    // Count reviews per user
    const reviewCounts: Record<string, number> = {};
    (remarks || []).forEach(remark => {
      reviewCounts[remark.remarked_by] = (reviewCounts[remark.remarked_by] || 0) + 1;
    });

    // Convert to leaderboard format and sort
    const leaderboard = Object.entries(reviewCounts)
      .map(([userId, count]) => {
        const emp = employeeMap[userId];
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: count,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Reviews completed leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching reviews completed leaderboard:", error);
    return [];
  }
};

// Get top 5 users by total earnings - Using RLS-unrestricted admin query approach
export const getHighestEarningsLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    // Query all employees first (unrestricted), then get their earnings via responses
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name");

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    if (!employees || employees.length === 0) {
      console.log("No employees found");
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    const userIds: string[] = [];
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
      userIds.push(emp.user_id);
    });

    // Get task earnings for each user - this uses RLS but we query per user
    const earningsTotal: Record<string, number> = {};
    
    for (const userId of userIds) {
      const { data: userEarnings, error: earningError } = await supabase
        .from("task_earnings")
        .select("amount")
        .eq("user_id", userId);

      if (!earningError && userEarnings) {
        earningsTotal[userId] = userEarnings.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
      }
    }

    // Convert to leaderboard format and sort
    const leaderboard = Object.entries(earningsTotal)
      .map(([userId, total]) => {
        const emp = employeeMap[userId];
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: Math.round(total * 100) / 100,
        };
      })
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Highest earnings leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching highest earnings leaderboard:", error);
    return [];
  }
};

// Get top 5 users by best attendance percentage
export const getBestAttendanceLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .eq("is_active", true);

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    if (!employees || employees.length === 0) {
      console.log("No active employees found");
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    const userIds: string[] = [];
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
      userIds.push(emp.user_id);
    });

    // Get attendance records for all users
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("user_id, status")
      .in("user_id", userIds);

    if (attError) {
      console.error("Error fetching attendance:", attError);
      return [];
    }

    // Calculate attendance percentage
    const attendanceStats: Record<string, { present: number; total: number }> = {};
    userIds.forEach(uid => {
      attendanceStats[uid] = { present: 0, total: 0 };
    });

    (attendance || []).forEach(record => {
      if (attendanceStats[record.user_id]) {
        attendanceStats[record.user_id].total += 1;
        if (record.status === "present" || record.status === "approved") {
          attendanceStats[record.user_id].present += 1;
        }
      }
    });

    // Convert to leaderboard format
    const leaderboard = Object.entries(attendanceStats)
      .map(([userId, stats]) => {
        const emp = employeeMap[userId];
        const percentage = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: Math.round(percentage * 100) / 100,
        };
      })
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Best attendance leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching best attendance leaderboard:", error);
    return [];
  }
};

// Get top 5 users by most approved tasks
export const getMostApprovedTasksLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name");

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    if (!employees || employees.length === 0) {
      console.log("No employees found");
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    const userIds: string[] = [];
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
      userIds.push(emp.user_id);
    });

    // Get approved earnings for each user
    const approvedCounts: Record<string, number> = {};
    
    for (const userId of userIds) {
      const { data: userApproved, error: approvalError } = await supabase
        .from("task_earnings")
        .select("id", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "approved");

      if (!approvalError) {
        approvedCounts[userId] = userApproved?.length || 0;
      }
    }

    // Convert to leaderboard format and sort
    const leaderboard = Object.entries(approvedCounts)
      .map(([userId, count]) => {
        const emp = employeeMap[userId];
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: count,
        };
      })
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Most approved tasks leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching most approved tasks leaderboard:", error);
    return [];
  }
};

// Get top 5 users by fastest task completion (average time)
export const getFastestTaskCompletionLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const { data: responses, error: respError } = await supabase
      .from("task_responses")
      .select("user_id, task_id, created_at");

    if (respError) {
      console.error("Error fetching task responses:", respError);
      return [];
    }

    if (!responses || responses.length === 0) {
      console.log("No task responses found");
      return [];
    }

    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("id, created_at");

    if (taskError) {
      console.error("Error fetching tasks:", taskError);
      return [];
    }

    // Create task created date map
    const taskCreatedMap: Record<string, string> = {};
    (tasks || []).forEach(task => {
      taskCreatedMap[task.id] = task.created_at || "";
    });

    // Get employee profiles
    const userIds = Array.from(new Set((responses || []).map(r => r.user_id)));
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
    });

    // Calculate average completion time in hours
    const completionTimes: Record<string, number[]> = {};
    (responses || []).forEach(response => {
      const taskCreated = taskCreatedMap[response.task_id];
      if (taskCreated) {
        const createdDate = new Date(taskCreated).getTime();
        const completedDate = new Date(response.created_at).getTime();
        const hours = (completedDate - createdDate) / (1000 * 60 * 60);
        
        if (!completionTimes[response.user_id]) {
          completionTimes[response.user_id] = [];
        }
        completionTimes[response.user_id].push(hours);
      }
    });

    // Convert to leaderboard format
    const leaderboard = Object.entries(completionTimes)
      .map(([userId, times]) => {
        const emp = employeeMap[userId];
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: Math.round(avgTime * 100) / 100,
        };
      })
      .filter(entry => entry.value > 0)
      .sort((a, b) => a.value - b.value) // Faster is better (lower hours)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Fastest task completion leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching fastest task completion leaderboard:", error);
    return [];
  }
};

// Get top 5 users by most working hours
export const getMostWorkingHoursLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const { data: employees, error: empError } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .eq("is_active", true);

    if (empError) {
      console.error("Error fetching employees:", empError);
      return [];
    }

    if (!employees || employees.length === 0) {
      console.log("No active employees found");
      return [];
    }

    const employeeMap: Record<string, { first_name: string; last_name: string }> = {};
    const userIds: string[] = [];
    employees?.forEach(emp => {
      employeeMap[emp.user_id] = { first_name: emp.first_name, last_name: emp.last_name };
      userIds.push(emp.user_id);
    });

    // Get attendance records with working hours
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("user_id, working_hours")
      .in("user_id", userIds);

    if (attError) {
      console.error("Error fetching attendance:", attError);
      return [];
    }

    // Sum working hours per user
    const hoursTotal: Record<string, number> = {};
    (attendance || []).forEach(record => {
      const hours = parseFloat(record.working_hours?.toString() || "0");
      hoursTotal[record.user_id] = (hoursTotal[record.user_id] || 0) + hours;
    });

    // Convert to leaderboard format and sort
    const leaderboard = Object.entries(hoursTotal)
      .map(([userId, total]) => {
        const emp = employeeMap[userId];
        return {
          userId,
          userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User",
          value: Math.round(total * 100) / 100,
        };
      })
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        medal: idx < 3 ? ["🥇", "🥈", "🥉"][idx] : undefined,
      }));

    console.log("Most working hours leaderboard:", leaderboard);
    return leaderboard;
  } catch (error) {
    console.error("Error fetching most working hours leaderboard:", error);
    return [];
  }
};
