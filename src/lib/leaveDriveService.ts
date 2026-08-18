import { supabase } from "@/integrations/supabase/client";

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  directViewLink: string;
  folderPath: string;
}

/**
 * Uploads a document related to a leave application or leave clarification chat to Google Drive.
 * Files are stored structurally: Google Drive Root -> leave -> [Employee Name] -> [File]
 */
export async function uploadLeaveDocumentToDrive(
  file: File,
  userName: string,
  leaveType: string = "Leave"
): Promise<DriveUploadResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userName", userName || "Employee");
    formData.append("taskName", leaveType);
    formData.append("submissionType", "leave"); // Triggers 'leave' folder hierarchy in Edge function

    const { data, error } = await supabase.functions.invoke("upload-to-drive", {
      body: formData,
    });

    if (error) {
      console.error("Supabase function error uploading leave document:", error);
      throw new Error(error.message || "Failed to upload document to Google Drive");
    }

    if (!data?.webViewLink) {
      throw new Error("Invalid response from Drive upload function");
    }

    return {
      fileId: data.fileId,
      fileName: data.fileName || file.name,
      webViewLink: data.webViewLink,
      directViewLink: data.directViewLink || data.webViewLink,
      folderPath: data.folderPath || `leave > ${userName}`,
    };
  } catch (err: any) {
    console.error("Error in uploadLeaveDocumentToDrive:", err);
    throw err;
  }
}
