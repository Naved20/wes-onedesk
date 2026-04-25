// Google Drive API utilities
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

let gapiInited = false;
let tokenClient: any = null;

// Load Google API script
const loadGoogleScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google API script'));
    };

    document.body.appendChild(script);
  });
};

export const initializeGoogleDrive = async (clientId: string, apiKey: string) => {
  try {
    // Load script first
    await loadGoogleScript();

    // Wait for gapi to be available
    let attempts = 0;
    while (!window.gapi && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.gapi) {
      throw new Error('Google API not loaded');
    }

    // Initialize gapi client
    await new Promise<void>((resolve, reject) => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInited = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    // Initialize Google Identity Services
    if (window.google?.accounts?.oauth2) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '',
      });
    }
  } catch (error) {
    console.error('Google Drive initialization error:', error);
    throw error;
  }
};

export const authenticateGoogleDrive = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Drive not initialized'));
      return;
    }

    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(response);
        return;
      }
      resolve(response.access_token);
    };

    tokenClient.requestAccessToken();
  });
};

export const uploadFileToDrive = async (
  file: File,
  folderId?: string
): Promise<DriveFile> => {
  const metadata = {
    name: file.name,
    mimeType: file.type,
    ...(folderId && { parents: [folderId] }),
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const token = gapi.client.getToken();
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: new Headers({ Authorization: 'Bearer ' + token.access_token }),
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload file to Google Drive');
  }

  return await response.json();
};

export const listDriveFiles = async (
  folderId?: string,
  pageSize: number = 10
): Promise<DriveFile[]> => {
  const query = folderId ? `'${folderId}' in parents` : undefined;
  
  const response = await gapi.client.drive.files.list({
    pageSize,
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink)',
    q: query,
    orderBy: 'modifiedTime desc',
  });

  return response.result.files || [];
};

export const deleteFileFromDrive = async (fileId: string): Promise<void> => {
  await (gapi.client.drive.files as any).delete({
    fileId,
  });
};

export const createDriveFolder = async (
  folderName: string,
  parentFolderId?: string
): Promise<DriveFile> => {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId && { parents: [parentFolderId] }),
  };

  const response = await gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id,name,mimeType,createdTime,modifiedTime',
  });

  return response.result;
};

export const downloadFileFromDrive = async (fileId: string, fileName: string): Promise<void> => {
  const token = gapi.client.getToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: new Headers({ Authorization: 'Bearer ' + token.access_token }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download file from Google Drive');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const getFileMetadata = async (fileId: string): Promise<DriveFile> => {
  const response = await gapi.client.drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink',
  });

  return response.result;
};
