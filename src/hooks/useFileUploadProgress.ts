import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseFileUploadProgressReturn {
  uploading: boolean;
  progress: UploadProgress;
  error: string | null;
  upload: (file: File, bucket: string, path: string) => Promise<{ publicUrl: string; filePath: string }>;
}

export const useFileUploadProgress = (): UseFileUploadProgressReturn => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, bucket: string, path: string): Promise<{ publicUrl: string; filePath: string }> => {
      setUploading(true);
      setError(null);
      setProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        // Use Supabase storage uploadToSignedUrl with XMLHttpRequest for progress tracking
        // First, get a signed URL
        const filePath = path;

        // Method 1: Use XMLHttpRequest for progress tracking with regular upload
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          // Track upload progress
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setProgress({
                loaded: event.loaded,
                total: event.total,
                percentage: percentComplete,
              });
            }
          });

          // Handle completion
          xhr.addEventListener('load', async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Upload successful via direct Supabase method
              try {
                const { data } = supabase.storage
                  .from(bucket)
                  .getPublicUrl(filePath);

                setProgress({ loaded: file.size, total: file.size, percentage: 100 });
                setUploading(false);

                resolve({
                  publicUrl: data.publicUrl,
                  filePath: filePath,
                });
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            setError('Upload failed');
            reject(new Error('Upload failed'));
          });

          xhr.addEventListener('abort', () => {
            setError('Upload cancelled');
            reject(new Error('Upload cancelled'));
          });

          // Use Supabase storage with FormData
          const formData = new FormData();
          formData.append('file', file);

          // Get Supabase storage URL and token for direct upload
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (!token) {
            throw new Error('Not authenticated');
          }

          const storageUrl = `${supabase.supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

          xhr.open('POST', storageUrl, true);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          xhr.send(formData);
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setUploading(false);
        throw err;
      }
    },
    []
  );

  // Alternative simpler method: Use Supabase storage.upload and estimate progress
  const uploadSimple = useCallback(
    async (file: File, bucket: string, path: string): Promise<{ publicUrl: string; filePath: string }> => {
      setUploading(true);
      setError(null);
      setProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        // Simulate progress with artificial steps (since Supabase SDK doesn't expose real progress)
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev.percentage < 90) {
              return {
                ...prev,
                loaded: prev.loaded + (file.size * 0.1),
                percentage: prev.percentage + 10,
              };
            }
            return prev;
          });
        }, 200);

        // Perform actual upload
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file);

        clearInterval(progressInterval);

        if (uploadError) throw uploadError;

        // Set progress to 100%
        setProgress({ loaded: file.size, total: file.size, percentage: 100 });

        // Get public URL
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        setUploading(false);

        return {
          publicUrl: data.publicUrl,
          filePath: path,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setUploading(false);
        throw err;
      }
    },
    []
  );

  return {
    uploading,
    progress,
    error,
    upload: uploadSimple, // Using simpler version that works with Supabase SDK
  };
};
