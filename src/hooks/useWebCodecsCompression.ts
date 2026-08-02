import { useState, useCallback } from 'react';

export interface WebCodecsCompressionOptions {
  width?: number;
  height?: number;
  bitrate?: number; // bits per second
  framerate?: number;
  quality?: number; // 0-51 (lower = better quality)
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalName: string;
}

export const useWebCodecsCompression = () => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const isWebCodecsSupported = () => {
    return 'VideoEncoder' in window && 'VideoDecoder' in window && 'VideoFrame' in window;
  };

  const compressVideo = useCallback(async (
    file: File,
    options: WebCodecsCompressionOptions = {}
  ): Promise<CompressionResult> => {
    setCompressing(true);
    setError(null);

    try {
      const {
        width = 1280,
        height = 720,
        bitrate = 500000, // 500kbps
        framerate = 25,
      } = options;

      console.log(`[WebCodecsCompression] Starting compression: ${file.name} (${formatBytes(file.size)})`);

      // Check WebCodecs support
      if (!isWebCodecsSupported()) {
        throw new Error('WebCodecs API not supported in this browser');
      }

      // Create video element
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      const videoURL = URL.createObjectURL(file);
      video.src = videoURL;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      console.log(`[WebCodecsCompression] Video loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);

      // Calculate target dimensions maintaining aspect ratio
      let targetWidth = width;
      let targetHeight = height;
      
      const aspectRatio = video.videoWidth / video.videoHeight;
      if (aspectRatio > targetWidth / targetHeight) {
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        targetWidth = Math.round(targetHeight * aspectRatio);
      }

      // Ensure dimensions are even (required for many codecs)
      targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

      console.log(`[WebCodecsCompression] Target dimensions: ${targetWidth}x${targetHeight}`);

      // Setup canvas for video processing
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Use MediaRecorder with canvas stream for simpler compression
      const stream = canvas.captureStream(framerate);
      
      // Find best supported codec
      const codecs = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8', 
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4'
      ];
      
      let selectedCodec = '';
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          selectedCodec = codec;
          break;
        }
      }
      
      if (!selectedCodec) {
        throw new Error('No supported video codec found');
      }

      console.log(`[WebCodecsCompression] Using MediaRecorder with: ${selectedCodec}`);

      const chunks: BlobPart[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedCodec,
        videoBitsPerSecond: bitrate,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const compressionPromise = new Promise<void>((resolve, reject) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.onerror = (event) => reject(new Error('MediaRecorder failed'));
      });

      // Start recording
      mediaRecorder.start();

      // Play video and draw frames
      video.currentTime = 0;
      await video.play();

      const drawFrames = () => {
        if (video.paused || video.ended) {
          mediaRecorder.stop();
          return;
        }
        
        // Draw current frame to canvas (automatically resized)
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Continue drawing frames
        requestAnimationFrame(drawFrames);
      };

      // Start drawing frames when video plays
      drawFrames();

      // Wait for compression to complete
      await compressionPromise;

      console.log(`[WebCodecsCompression] Compression complete, creating file...`);

      // Create compressed file
      const compressedBlob = new Blob(chunks, { type: selectedCodec });
      const extension = selectedCodec.includes('webm') ? 'webm' : 'mp4';
      
      const compressedFile = new File(
        [compressedBlob],
        `${file.name.split('.')[0]}_compressed.${extension}`,
        { type: selectedCodec }
      );

      // Calculate compression results
      const compressionRatio = file.size / compressedFile.size;
      const reduction = Math.round((1 - 1/compressionRatio) * 100);
      const savedBytes = file.size - compressedFile.size;

      console.log(`[WebCodecsCompression] ✅ Success! Reduced by ${reduction}%`);
      console.log(`[WebCodecsCompression] Original: ${formatBytes(file.size)} → Compressed: ${formatBytes(compressedFile.size)} (Saved ${formatBytes(savedBytes)})`);

      // Cleanup
      URL.revokeObjectURL(videoURL);
      setCompressing(false);

      return {
        file: compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio,
        originalName: file.name,
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'WebCodecs compression failed';
      console.error('[WebCodecsCompression] ❌ Error:', errorMsg);
      setError(errorMsg);
      setCompressing(false);
      
      console.warn('[WebCodecsCompression] Falling back to original file');
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 1,
        originalName: file.name,
      };
    }
  }, []);

  return {
    compressing,
    error,
    compressVideo,
    formatBytes,
    isWebCodecsSupported,
  };
};