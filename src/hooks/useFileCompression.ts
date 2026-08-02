import { useState, useCallback } from 'react';

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

let FFmpegInstance: any = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

const loadFFmpeg = async () => {
  if (ffmpegLoaded && FFmpegInstance) return true;
  if (ffmpegLoading) {
    let attempts = 0;
    while (ffmpegLoading && attempts < 100) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    return ffmpegLoaded && !!FFmpegInstance;
  }

  ffmpegLoading = true;
  try {
    console.log('[FFmpeg] Loading FFmpeg WASM module v0.11.6 (stable)...');
    
    // v0.11.6 uses createFFmpeg() factory function, NOT class
    const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
    
    console.log('[FFmpeg] createFFmpeg function loaded');
    
    // Create instance using factory function
    // Use single-threaded core (no SharedArrayBuffer needed)
    const ffmpeg = createFFmpeg({ 
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
    });
    
    console.log('[FFmpeg] FFmpeg instance created (single-threaded), loading core...');
    
    // Load FFmpeg core WASM
    await ffmpeg.load();
    
    console.log('[FFmpeg] ✅ FFmpeg loaded successfully (single-threaded mode)');
    
    FFmpegInstance = { instance: ffmpeg, fetchFile };
    ffmpegLoaded = true;
    ffmpegLoading = false;
    
    return true;
  } catch (err) {
    console.error('[FFmpeg] ❌ Load failed:', err instanceof Error ? err.message : String(err));
    FFmpegInstance = null;
    ffmpegLoaded = false;
    ffmpegLoading = false;
    return false;
  }
};

export const useFileCompression = () => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { videoBitrate = '500k' } = options;

      console.log(`[VideoCompression] Starting compression: ${file.name} (${formatBytes(file.size)})`);
      
      const ffmpegAvailable = await loadFFmpeg();
      
      if (!ffmpegAvailable) {
        console.warn('[VideoCompression] FFmpeg unavailable, using original file');
        return {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1,
          originalName: file.name,
        };
      }

      if (!FFmpegInstance) {
        throw new Error('FFmpeg instance failed to initialize');
      }

      const { instance: ffmpeg, fetchFile } = FFmpegInstance;
      
      const ext = file.name.split('.').pop() || 'mp4';
      const inputName = `input.${ext}`;
      const outputName = `output.mp4`;

      console.log('[VideoCompression] Preparing file for compression...');
      
      const fileData = await fetchFile(file);
      ffmpeg.FS('writeFile', inputName, fileData);

      console.log(`[VideoCompression] Compressing with ${videoBitrate} bitrate (ultrafast)...`);

      await ffmpeg.run(
        '-i', inputName,
        '-b:v', videoBitrate,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
      );

      console.log('[VideoCompression] Compression complete, reading output...');

      const compressedData = ffmpeg.FS('readFile', outputName);
      const compressedBlob = new Blob([compressedData.buffer], { type: 'video/mp4' });
      const compressedFile = new File(
        [compressedBlob],
        `${file.name.split('.')[0]}_compressed.mp4`,
        { type: 'video/mp4' }
      );

      ffmpeg.FS('unlink', inputName);
      ffmpeg.FS('unlink', outputName);

      const compressionRatio = file.size / compressedFile.size;
      const reduction = Math.round((1 - 1/compressionRatio) * 100);
      const savedBytes = file.size - compressedFile.size;
      
      console.log(`[VideoCompression] ✅ Success! Reduced by ${reduction}%`);
      console.log(`[VideoCompression] Original: ${formatBytes(file.size)} → Compressed: ${formatBytes(compressedFile.size)} (Saved ${formatBytes(savedBytes)})`);

      setCompressing(false);
      return {
        file: compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio,
        originalName: file.name,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Compression failed';
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
  }, [formatBytes]);

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
    compressing,
    error,
    compressFile,
    compressImage,
    compressVideo,
    formatBytes,
  };
};
