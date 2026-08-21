import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "./audioNotification";

export type NotificationType = 
  | "announcement" 
  | "leave" 
  | "attendance" 
  | "task" 
  | "salary" 
  | "document" 
  | "support";

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
}

/**
 * Send a notification to a user
 */
export async function sendNotification(payload: NotificationPayload) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      related_id: payload.relatedId || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error sending notification:", error);
      throw error;
    }

    // Play notification sound
    playNotificationSound(payload.title);

    // Send to mobile device via Firebase (async, don't wait)
    sendMobileNotification(payload).catch(err => 
      console.error("Failed to send mobile notification:", err)
    );

    return true;
  } catch (error) {
    console.error("Notification service error:", error);
    return false;
  }
}

/**
 * Send notification to multiple users
 */
export async function sendNotificationToMany(
  userIds: string[],
  payload: Omit<NotificationPayload, "userId">
) {
  try {
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      related_id: payload.relatedId || null,
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("notifications")
      .insert(notifications);

    if (error) {
      console.error("Error sending notifications:", error);
      throw error;
    }

    // Play notification sound once for bulk sends
    playNotificationSound(payload.title);

    return true;
  } catch (error) {
    console.error("Notification service error:", error);
    return false;
  }
}

/**
 * Get all user IDs with Admin or Manager role
 */
export async function getAdminAndManagerIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    if (error) {
      console.error("Error fetching admin and manager IDs:", error);
      return [];
    }

    return data?.map((r) => r.user_id) || [];
  } catch (error) {
    console.error("Error fetching admin/manager IDs:", error);
    return [];
  }
}

/**
 * Send notification to all Admins and Managers
 */
export async function notifyAdminsAndManagers(
  payload: Omit<NotificationPayload, "userId">
) {
  const adminAndManagerIds = await getAdminAndManagerIds();
  if (adminAndManagerIds.length === 0) return false;

  return sendNotificationToMany(adminAndManagerIds, payload);
}

/**
 * Map notification type to target app route for direct navigation
 */
export function getNotificationRoute(type: string, relatedId?: string | null): string {
  switch (type) {
    case "leave":
      return "/leaves";
    case "task":
      return "/tasks";
    case "support":
      return "/support-requests";
    case "attendance":
      return "/attendance";
    case "salary":
      return "/salaries";
    case "announcement":
      return "/announcements";
    case "document":
      return "/documents";
    case "report":
      return "/uploaded-reports";
    default:
      return "/dashboard";
  }
}

/**
 * Salary-related notifications
 */
export const salaryNotifications = {
  generated: (userId: string, month: string, year: number) =>
    sendNotification({
      userId,
      title: "Salary Generated",
      message: `Salary for ${month} ${year} has been generated and is pending approval.`,
      type: "salary",
    }),

  approved: (userId: string, month: string, year: number) =>
    sendNotification({
      userId,
      title: "Salary Approved",
      message: `Your salary for ${month} ${year} has been approved.`,
      type: "salary",
    }),

  locked: (userId: string, month: string, year: number) =>
    sendNotification({
      userId,
      title: "Salary Locked",
      message: `Salary for ${month} ${year} has been locked and finalized.`,
      type: "salary",
    }),

  updated: (userId: string, month: string, year: number) =>
    sendNotification({
      userId,
      title: "Salary Updated",
      message: `Your salary for ${month} ${year} has been updated.`,
      type: "salary",
    }),
};

/**
 * Leave-related notifications
 */
export const leaveNotifications = {
  applied: async (userId: string, employeeName: string, leaveType: string, days: number, startDate: string, leaveId?: string) => {
    // Notify employee
    await sendNotification({
      userId,
      title: "Leave Applied",
      message: `Your ${leaveType} leave for ${days} day(s) starting ${startDate} has been submitted for approval.`,
      type: "leave",
      relatedId: leaveId,
    });
    // Notify admins & managers for action
    await notifyAdminsAndManagers({
      title: `Leave Request: ${employeeName}`,
      message: `${employeeName} requested ${days} day(s) of ${leaveType} leave starting ${startDate}. Click to review.`,
      type: "leave",
      relatedId: leaveId,
    });
  },

  approved: (userId: string, leaveType: string, startDate: string, leaveId?: string) =>
    sendNotification({
      userId,
      title: "Leave Approved",
      message: `Your ${leaveType} leave starting ${startDate} has been approved.`,
      type: "leave",
      relatedId: leaveId,
    }),

  rejected: (userId: string, leaveType: string, reason: string, leaveId?: string) =>
    sendNotification({
      userId,
      title: "Leave Rejected",
      message: `Your ${leaveType} leave has been rejected. ${reason ? `Reason: ${reason}` : ""}`,
      type: "leave",
      relatedId: leaveId,
    }),

  forApproval: (userId: string, employeeName: string, leaveType: string, days: number, leaveId?: string) =>
    sendNotification({
      userId,
      title: `Leave Request from ${employeeName}`,
      message: `${employeeName} has requested ${leaveType} leave for ${days} day(s). Please review and approve.`,
      type: "leave",
      relatedId: leaveId,
    }),
};

/**
 * Attendance-related notifications
 */
export const attendanceNotifications = {
  checkIn: async (userId: string, employeeName: string, time: string) => {
    await sendNotification({
      userId,
      title: "Attendance Checked In",
      message: `You have checked in at ${time}.`,
      type: "attendance",
    });
    // Also notify admins & managers
    await notifyAdminsAndManagers({
      title: `Check-In: ${employeeName}`,
      message: `${employeeName} checked in at ${time}.`,
      type: "attendance",
    });
  },

  checkOut: (userId: string, time: string) =>
    sendNotification({
      userId,
      title: "Attendance Checked Out",
      message: `You have checked out at ${time}.`,
      type: "attendance",
    }),

  absent: async (userId: string, employeeName: string, date: string) => {
    await sendNotification({
      userId,
      title: "Absence Recorded",
      message: `Absence has been recorded for ${date}.`,
      type: "attendance",
    });
    await notifyAdminsAndManagers({
      title: `Absent Marked: ${employeeName}`,
      message: `${employeeName} was marked absent for ${date}.`,
      type: "attendance",
    });
  },

  forApproval: (userId: string, employeeName: string) =>
    sendNotification({
      userId,
      title: `Attendance Approval Needed`,
      message: `${employeeName}'s attendance record needs your review and approval.`,
      type: "attendance",
    }),

  approved: (userId: string) =>
    sendNotification({
      userId,
      title: "Attendance Approved",
      message: `Your attendance has been approved.`,
      type: "attendance",
    }),

  rejected: (userId: string, reason: string) =>
    sendNotification({
      userId,
      title: "Attendance Rejected",
      message: `Your attendance has been rejected. Reason: ${reason || "No reason provided"}`,
      type: "attendance",
    }),
};

/**
 * Task-related notifications
 */
export const taskNotifications = {
  assigned: (userId: string, taskTitle: string, dueDate: string, taskId?: string) =>
    sendNotification({
      userId,
      title: "Task Assigned",
      message: `You have been assigned a new task: "${taskTitle}" due on ${dueDate}.`,
      type: "task",
      relatedId: taskId,
    }),

  submitted: async (employeeName: string, taskTitle: string, taskId?: string) => {
    await notifyAdminsAndManagers({
      title: `Task Submitted: ${employeeName}`,
      message: `${employeeName} submitted task "${taskTitle}" for review.`,
      type: "task",
      relatedId: taskId,
    });
  },

  completed: (userId: string, taskTitle: string, employeeName: string, taskId?: string) =>
    sendNotification({
      userId,
      title: "Task Completed",
      message: `${employeeName} has completed the task "${taskTitle}".`,
      type: "task",
      relatedId: taskId,
    }),

  dueSoon: (userId: string, taskTitle: string, daysLeft: number, taskId?: string) =>
    sendNotification({
      userId,
      title: "Task Due Soon",
      message: `Task "${taskTitle}" is due in ${daysLeft} day(s).`,
      type: "task",
      relatedId: taskId,
    }),

  overdue: (userId: string, taskTitle: string, taskId?: string) =>
    sendNotification({
      userId,
      title: "Task Overdue",
      message: `Task "${taskTitle}" is now overdue. Please complete it as soon as possible.`,
      type: "task",
      relatedId: taskId,
    }),

  earningsReleased: (userId: string, amount: number) =>
    sendNotification({
      userId,
      title: "Task Earnings Released",
      message: `You have earned ₹${amount.toLocaleString()} from completed tasks.`,
      type: "task",
    }),
};

/**
 * Document-related notifications
 */
export const documentNotifications = {
  shared: (userId: string, documentName: string, sharedBy: string) =>
    sendNotification({
      userId,
      title: "Document Shared",
      message: `${sharedBy} has shared "${documentName}" with you.`,
      type: "document",
    }),

  uploaded: (userId: string, documentName: string) =>
    sendNotification({
      userId,
      title: "Document Uploaded",
      message: `"${documentName}" has been successfully uploaded.`,
      type: "document",
    }),
};

/**
 * Support-related notifications
 */
export const supportNotifications = {
  ticketCreated: async (userId: string, ticketId: string, subject: string, employeeName?: string) => {
    // Notify creator
    await sendNotification({
      userId,
      title: "Support Ticket Created",
      message: `Your support ticket #${ticketId} has been created: "${subject}".`,
      type: "support",
      relatedId: ticketId,
    });
    // Notify Admins & Managers
    await notifyAdminsAndManagers({
      title: `Support Requested: ${employeeName || "Employee"}`,
      message: `New support ticket #${ticketId}: "${subject}". Click to review and reply.`,
      type: "support",
      relatedId: ticketId,
    });
  },

  replyMade: async (recipientUserId: string, ticketId: string, senderName: string, snippet: string) => {
    await sendNotification({
      userId: recipientUserId,
      title: `New Reply on Ticket #${ticketId}`,
      message: `${senderName}: "${snippet}"`,
      type: "support",
      relatedId: ticketId,
    });
  },

  ticketResolved: (userId: string, ticketId: string) =>
    sendNotification({
      userId,
      title: "Support Ticket Resolved",
      message: `Your support ticket #${ticketId} has been resolved.`,
      type: "support",
      relatedId: ticketId,
    }),
};

/**
 * General broadcast notification to multiple users
 */
export async function broadcastAnnouncement(
  title: string,
  message: string,
  userIds: string[]
) {
  return sendNotificationToMany(userIds, {
    title,
    message,
    type: "announcement",
  });
}

/**
 * Send notification to mobile device
 */
async function sendMobileNotification(payload: NotificationPayload) {
  try {
    // Call backend Cloud Function to send FCM message
    const response = await supabase.functions.invoke("send-fcm-notification", {
      body: {
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        relatedId: payload.relatedId,
      },
    });

    if (response.error) {
      console.error("Error sending FCM notification:", response.error);
    }
  } catch (error) {
    // Silently fail - mobile notification is optional
    console.debug("Mobile notification not available:", error);
  }
}

