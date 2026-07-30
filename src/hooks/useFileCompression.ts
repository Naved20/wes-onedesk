import { useState, useCallback } from 'react';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for images
  maxSizeKB?: number; // Max size in KB
  videoBitrate?: string; // Video bitrate like "500k", "1M"
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalName: string;
}

// Load FFmpeg dynamically
let FFmpeg: any = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

const loadFFmpeg = async () => {
  if (ffmpegLoaded) return true;
  if (ffmpegLoading) {
    // Wait for ongoing load
    let attempts = 0;
    while (ffmpegLoading && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    return ffmpegLoaded;
  }

  ffmpegLoading = true;
  try {
    const ffmpegMod: any = await import('@ffmpeg/ffmpeg');
    const FFmpegClass = ffmpegMod.FFmpeg;
    const fetchFile = ffmpegMod.fetchFile ?? (async (f: any) => new Uint8Array(await (f as Blob).arrayBuffer()));
    FFmpeg = { FFmpeg: FFmpegClass, fetchFile };
    await FFmpeg.FFmpeg.load();
    ffmpegLoaded = true;
    return true;
  } catch (err) {
    console.error('[FFmpeg] Failed to load:', err);
    ffmpegLoading = false;
    return false;
  }
};

export const useFileCompression = () => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compress video using FFmpeg
  const compressVideo = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    setCompressing(true);
    setError(null);

    try {
      const { videoBitrate = '500k', maxSizeKB = 100000 } = options;

      // Try to load FFmpeg
      const ffmpegAvailable = await loadFFmpeg();
      
      if (!ffmpegAvailable) {
        console.warn('[VideoCompression] FFmpeg not available, using original file');
        return {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1,
          originalName: file.name,
        };
      }

      const { FFmpeg: FFmpegClass, fetchFile } = FFmpeg;
      const ffmpeg = new FFmpegClass();
      
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      // Get file extension
      const ext = file.name.split('.').pop() || 'mp4';
      const inputName = `input.${ext}`;
      const outputName = `output.mp4`;

      // Write input file to FFmpeg
      const fileData = await fetchFile(file);
      ffmpeg.FS('writeFile', inputName, fileData);

      console.log(`[VideoCompression] Compressing video with bitrate: ${videoBitrate}`);

      // Compress video
      await ffmpeg.run(
        '-i', inputName,
        '-b:v', videoBitrate,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
      );

      // Read compressed file
      const compressedData = ffmpeg.FS('readFile', outputName);
      const compressedBlob = new Blob([compressedData.buffer], { type: 'video/mp4' });
      const compressedFile = new File([compressedBlob], `${file.name.split('.')[0]}_compressed.mp4`, { type: 'video/mp4' });

      // Clean up
      ffmpeg.FS('unlink', inputName);
      ffmpeg.FS('unlink', outputName);

      const compressionRatio = file.size / compressedFile.size;
      const savedSize = file.size - compressedFile.size;

      console.log(`[VideoCompression] Success! Saved ${formatBytes(savedSize)} (${Math.round((1 - 1/compressionRatio) * 100)}% reduction)`);
      console.log(`[VideoCompression] Original: ${formatBytes(file.size)}, Compressed: ${formatBytes(compressedFile.size)}`);

      setCompressing(false);
      return {
        file: compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio,
        originalName: file.name,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Video compression failed';
      console.error('[VideoCompression] Error:', errorMessage);
      setError(errorMessage);
      setCompressing(false);
      
      // Fallback: return original file
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 1,
        originalName: file.name,
      };
    }
  }, []);

  // Compress image using canvas
  const compressImage = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    return new Promise((resolve, reject) => {
      setCompressing(true);
      setError(null);

      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
      } = options;

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const img = new Image();
          img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            // Create canvas and compress
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  throw new Error('Could not compress image');
                }

                // Create new file from blob
                const compressedFile = new File(
                  [blob],
                  file.name,
                  { type: file.type }
                );

                const compressionRatio = file.size / blob.size;

                resolve({
                  file: compressedFile,
                  originalSize: file.size,
                  compressedSize: blob.size,
                  compressionRatio,
                  originalName: file.name,
                });

                setCompressing(false);
              },
              file.type,
              quality
            );
          };

          img.onerror = () => {
            setError('Failed to load image');
            setCompressing(false);
            reject(new Error('Failed to load image'));
          };

          img.src = event.target?.result as string;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Compression failed';
          setError(errorMessage);
          setCompressing(false);
          reject(err);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setCompressing(false);
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Generic compression - detects file type
  const compressFile = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    const mimeType = file.type.toLowerCase();

    // Image compression
    if (mimeType.startsWith('image/')) {
      return compressImage(file, options);
    }

    // Video compression with FFmpeg
    if (mimeType.startsWith('video/')) {
      return compressVideo(file, options);
    }

    // PDF and other files - return as-is
    return Promise.resolve({
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 1,
      originalName: file.name,
    });
  }, [compressImage, compressVideo]);

  return {
    compressing,
    error,
    compressFile,
    compressImage,
    compressVideo,
    formatBytes,
  };
};
