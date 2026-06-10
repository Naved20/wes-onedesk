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
  applied: (userId: string, leaveType: string, days: number, startDate: string) =>
    sendNotification({
      userId,
      title: "Leave Applied",
      message: `Your ${leaveType} leave for ${days} day(s) starting ${startDate} has been submitted for approval.`,
      type: "leave",
    }),

  approved: (userId: string, leaveType: string, startDate: string) =>
    sendNotification({
      userId,
      title: "Leave Approved",
      message: `Your ${leaveType} leave starting ${startDate} has been approved.`,
      type: "leave",
    }),

  rejected: (userId: string, leaveType: string, reason: string) =>
    sendNotification({
      userId,
      title: "Leave Rejected",
      message: `Your ${leaveType} leave has been rejected. ${reason ? `Reason: ${reason}` : ""}`,
      type: "leave",
    }),

  forApproval: (userId: string, employeeName: string, leaveType: string, days: number) =>
    sendNotification({
      userId,
      title: `Leave Request from ${employeeName}`,
      message: `${employeeName} has requested ${leaveType} leave for ${days} day(s). Please review and approve.`,
      type: "leave",
    }),
};

/**
 * Attendance-related notifications
 */
export const attendanceNotifications = {
  checkIn: (userId: string, time: string) =>
    sendNotification({
      userId,
      title: "Attendance Checked In",
      message: `You have checked in at ${time}.`,
      type: "attendance",
    }),

  checkOut: (userId: string, time: string) =>
    sendNotification({
      userId,
      title: "Attendance Checked Out",
      message: `You have checked out at ${time}.`,
      type: "attendance",
    }),

  absent: (userId: string, date: string) =>
    sendNotification({
      userId,
      title: "Absence Recorded",
      message: `Absence has been recorded for ${date}.`,
      type: "attendance",
    }),

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
  assigned: (userId: string, taskTitle: string, dueDate: string) =>
    sendNotification({
      userId,
      title: "Task Assigned",
      message: `You have been assigned a new task: "${taskTitle}" due on ${dueDate}.`,
      type: "task",
    }),

  completed: (userId: string, taskTitle: string, employeeName: string) =>
    sendNotification({
      userId,
      title: "Task Completed",
      message: `${employeeName} has completed the task "${taskTitle}".`,
      type: "task",
    }),

  dueSoon: (userId: string, taskTitle: string, daysLeft: number) =>
    sendNotification({
      userId,
      title: "Task Due Soon",
      message: `Task "${taskTitle}" is due in ${daysLeft} day(s).`,
      type: "task",
    }),

  overdue: (userId: string, taskTitle: string) =>
    sendNotification({
      userId,
      title: "Task Overdue",
      message: `Task "${taskTitle}" is now overdue. Please complete it as soon as possible.`,
      type: "task",
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
  ticketCreated: (userId: string, ticketId: string, subject: string) =>
    sendNotification({
      userId,
      title: "Support Ticket Created",
      message: `Your support ticket #${ticketId} has been created: "${subject}".`,
      type: "support",
    }),

  ticketResolved: (userId: string, ticketId: string) =>
    sendNotification({
      userId,
      title: "Support Ticket Resolved",
      message: `Your support ticket #${ticketId} has been resolved.`,
      type: "support",
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
