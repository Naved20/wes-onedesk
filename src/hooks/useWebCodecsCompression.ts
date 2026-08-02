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
        quality = 28 // Good balance of quality/size
      } = options;

      console.log(`[WebCodecsCompression] Starting compression: ${file.name} (${formatBytes(file.size)})`);

      // Check WebCodecs support
      if (!isWebCodecsSupported()) {
        throw new Error('WebCodecs API not supported in this browser');
      }

      // Check codec support
      const codecConfig = {
        codec: 'avc1.42E01E', // H.264 Baseline
        width,
        height,
        bitrate,
        framerate,
      };

      const encoderSupport = await VideoEncoder.isConfigSupported(codecConfig);
      if (!encoderSupport.supported) {
        console.warn('[WebCodecsCompression] H.264 not supported, trying VP9...');
        codecConfig.codec = 'vp09.00.10.08'; // VP9
        const vp9Support = await VideoEncoder.isConfigSupported(codecConfig);
        if (!vp9Support.supported) {
          throw new Error('No supported video codecs available');
        }
      }

      console.log(`[WebCodecsCompression] Using codec: ${codecConfig.codec}`);

      // Create video element for decoding
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
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

      console.log(`[WebCodecsCompression] Target dimensions: ${targetWidth}x${targetHeight}`);

      // Setup canvas for frame extraction
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Encoded chunks storage
      const encodedChunks: EncodedVideoChunk[] = [];

      // Create encoder
      const encoder = new VideoEncoder({
        output: (chunk) => {
          encodedChunks.push(chunk);
        },
        error: (error) => {
          console.error('[WebCodecsCompression] Encoder error:', error);
          throw error;
        }
      });

      // Configure encoder
      encoder.configure({
        codec: codecConfig.codec,
        width: targetWidth,
        height: targetHeight,
        bitrate: bitrate,
        framerate: framerate,
        bitrateMode: 'variable' as any,
        latencyMode: 'quality' as any,
      });

      console.log('[WebCodecsCompression] Encoder configured, processing frames...');

      // Process video frames
      const frameDuration = 1000000 / framerate; // microseconds
      const totalFrames = Math.floor(video.duration * framerate);
      let processedFrames = 0;

      for (let i = 0; i < totalFrames; i++) {
        const timeInSeconds = i / framerate;
        
        // Seek to specific time
        video.currentTime = timeInSeconds;
        await new Promise(resolve => {
          video.onseeked = resolve;
        });

        // Draw frame to canvas (resized)
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        // Create VideoFrame from canvas
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const videoFrame = new VideoFrame(imageData, {
          timestamp: i * frameDuration,
          duration: frameDuration,
        });

        // Encode frame
        const keyFrame = i % 30 === 0; // Keyframe every 30 frames
        encoder.encode(videoFrame, { keyFrame });

        // Clean up frame
        videoFrame.close();
        
        processedFrames++;
        
        // Progress logging
        if (processedFrames % 25 === 0 || processedFrames === totalFrames) {
          console.log(`[WebCodecsCompression] Progress: ${processedFrames}/${totalFrames} frames (${Math.round(processedFrames/totalFrames*100)}%)`);
        }
      }

      // Finish encoding
      await encoder.flush();
      encoder.close();

      console.log(`[WebCodecsCompression] Encoding complete. ${encodedChunks.length} chunks created.`);

      // Create MP4 container (simplified - just concatenate chunks)
      const totalSize = encodedChunks.reduce((size, chunk) => size + chunk.byteLength, 0);
      const compressedData = new Uint8Array(totalSize);
      
      let offset = 0;
      for (const chunk of encodedChunks) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        compressedData.set(data, offset);
        offset += chunk.byteLength;
      }

      // Create compressed file
      const mimeType = codecConfig.codec.startsWith('avc1') ? 'video/mp4' : 'video/webm';
      const extension = codecConfig.codec.startsWith('avc1') ? 'mp4' : 'webm';
      
      const compressedBlob = new Blob([compressedData], { type: mimeType });
      const compressedFile = new File(
        [compressedBlob],
        `${file.name.split('.')[0]}_compressed.${extension}`,
        { type: mimeType }
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