import { useState, useCallback } from 'react';
import { useWebCodecsCompression } from './useWebCodecsCompression';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  videoBitrate?: string;
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalName: string;
}

export const useFileCompression = () => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use WebCodecs for video compression
  const { 
    compressVideo: webCodecsCompress, 
    compressing: webCodecsCompressing,
    error: webCodecsError,
    isWebCodecsSupported 
  } = useWebCodecsCompression();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const compressVideo = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    setCompressing(true);
    setError(null);

    try {
      const { maxWidth = 1280, maxHeight = 720, videoBitrate = '500k' } = options;
      
      // Convert bitrate string to number
      let bitrateNum = 500000; // Default 500kbps
      if (videoBitrate.endsWith('k')) {
        bitrateNum = parseInt(videoBitrate) * 1000;
      } else if (videoBitrate.endsWith('M')) {
        bitrateNum = parseInt(videoBitrate) * 1000000;
      }

      console.log(`[VideoCompression] Using WebCodecs API for: ${file.name} (${formatBytes(file.size)})`);

      if (!isWebCodecsSupported()) {
        console.warn('[VideoCompression] WebCodecs not supported, using original file');
        return {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1,
          originalName: file.name,
        };
      }

      const result = await webCodecsCompress(file, {
        width: maxWidth,
        height: maxHeight,
        bitrate: bitrateNum,
        framerate: 25,
        quality: 28,
      });

      setCompressing(false);
      return result;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Video compression failed';
      console.error('[VideoCompression] ❌ Error:', errorMsg);
      setError(errorMsg);
      setCompressing(false);
      
      console.warn('[VideoCompression] Falling back to original file');
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 1,
        originalName: file.name,
      };
    }
  }, [webCodecsCompress, isWebCodecsSupported]);

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
        quality = 0.85,
      } = options;

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              throw new Error('Canvas context failed');
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  throw new Error('Image compression failed');
                }

                const compressedFile = new File(
                  [blob],
                  file.name,
                  { type: file.type }
                );

                const compressionRatio = file.size / blob.size;
                const reduction = Math.round((1 - 1/compressionRatio) * 100);
                
                console.log(`[ImageCompression] ✅ Reduced by ${reduction}%`);
                console.log(`[ImageCompression] Original: ${formatBytes(file.size)} → Compressed: ${formatBytes(blob.size)}`);

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
            setError('Image load failed');
            setCompressing(false);
            reject(new Error('Image load failed'));
          };

          img.src = event.target?.result as string;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Compression failed';
          setError(errorMsg);
          setCompressing(false);
          reject(err);
        }
      };

      reader.onerror = () => {
        setError('File read failed');
        setCompressing(false);
        reject(new Error('File read failed'));
      };

      reader.readAsDataURL(file);
    });
  }, [formatBytes]);

  const compressFile = useCallback(async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    const mimeType = file.type.toLowerCase();

    if (mimeType.startsWith('image/')) {
      return compressImage(file, options);
    }

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
    compressing: compressing || webCodecsCompressing,
    error: error || webCodecsError,
    compressFile,
    compressImage,
    compressVideo,
    formatBytes,
  };
};
