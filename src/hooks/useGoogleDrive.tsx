import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  initializeGoogleDrive,
  authenticateGoogleDrive,
  uploadFileToDrive,
  listDriveFiles,
  deleteFileFromDrive,
  createDriveFolder,
  downloadFileFromDrive,
  getFileMetadata,
  makeFilePublic,
  DriveFile,
} from '@/lib/googleDrive';

export const useGoogleDrive = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  useEffect(() => {
    const initDrive = async () => {
      if (clientId && apiKey) {
        try {
          await initializeGoogleDrive(clientId, apiKey);
          setIsInitialized(true);
        } catch (error) {
          console.error('Failed to initialize Google Drive:', error);
          toast.error('Google Drive initialization failed. Please refresh the page.');
        }
      }
    };

    initDrive();
  }, [clientId, apiKey]);

  const authenticate = async () => {
    if (!isInitialized) {
      toast.error('Google Drive not initialized');
      return false;
    }

    try {
      setIsLoading(true);
      await authenticateGoogleDrive();
      setIsAuthenticated(true);
      toast.success('Successfully authenticated with Google Drive');
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      toast.error('Failed to authenticate with Google Drive');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async (file: File, folderId?: string) => {
    if (!isAuthenticated) {
      const authenticated = await authenticate();
      if (!authenticated) return null;
    }

    try {
      setIsLoading(true);
      const uploadedFile = await uploadFileToDrive(file, folderId);
      try {
        await makeFilePublic(uploadedFile.id);
      } catch (permissionErr) {
        console.error('Failed to make file public:', permissionErr);
      }
      toast.success(`File "${file.name}" uploaded successfully`);
      return uploadedFile;
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiles = async (folderId?: string, pageSize?: number) => {
    if (!isAuthenticated) {
      const authenticated = await authenticate();
      if (!authenticated) return;
    }

    try {
      setIsLoading(true);
      const driveFiles = await listDriveFiles(folderId, pageSize);
      setFiles(driveFiles);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files from Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFile = async (fileId: string, fileName: string) => {
    if (!isAuthenticated) {
      toast.error('Not authenticated');
      return false;
    }

    try {
      setIsLoading(true);
      await deleteFileFromDrive(fileId);
      setFiles(files.filter(f => f.id !== fileId));
      toast.success(`File "${fileName}" deleted successfully`);
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete file');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async (folderName: string, parentFolderId?: string) => {
    if (!isAuthenticated) {
      const authenticated = await authenticate();
      if (!authenticated) return null;
    }

    try {
      setIsLoading(true);
      const folder = await createDriveFolder(folderName, parentFolderId);
      toast.success(`Folder "${folderName}" created successfully`);
      return folder;
    } catch (error) {
      console.error('Create folder failed:', error);
      toast.error('Failed to create folder');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    if (!isAuthenticated) {
      toast.error('Not authenticated');
      return false;
    }

    try {
      setIsLoading(true);
      await downloadFileFromDrive(fileId, fileName);
      toast.success(`File "${fileName}" downloaded successfully`);
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getMetadata = async (fileId: string) => {
    if (!isAuthenticated) {
      toast.error('Not authenticated');
      return null;
    }

    try {
      const metadata = await getFileMetadata(fileId);
      return metadata;
    } catch (error) {
      console.error('Failed to get metadata:', error);
      toast.error('Failed to get file metadata');
      return null;
    }
  };

  return {
    isInitialized,
    isAuthenticated,
    isLoading,
    files,
    authenticate,
    uploadFile,
    loadFiles,
    deleteFile,
    createFolder,
    downloadFile,
    getMetadata,
  };
};
