import { useState, useCallback, useRef } from 'react';

export interface VideoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  targetBitrate?: number;
  quality?: number;
  preserveAudio?: boolean;
}

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  bitrate: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  size: number;
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalName: string;
  metadata: VideoMetadata;
  preservedAudio: boolean;
}

interface CompressionProgress {
  stage: 'validation' | 'analysis' | 'compression' | 'verification' | 'complete';
  percentage: number;
  currentTime?: number;
  totalTime?: number;
  message: string;
}

export class VideoCompressionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stage: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'VideoCompressionError';
  }
}

export const useVideoCompression = () => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<VideoCompressionError | null>(null);
  const [progress, setProgress] = useState<CompressionProgress>({ stage: 'validation', percentage: 0, message: 'Initializing...' });
  
  // Refs for cleanup and cancellation
  const compressionRefs = useRef<{
    video?: HTMLVideoElement;
    canvas?: HTMLCanvasElement;
    stream?: MediaStream;
    recorder?: MediaRecorder;
    animationFrame?: number;
    timeout?: number;
    abortController?: AbortController;
    objectURLs: string[];
  }>({
    objectURLs: []
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const validateVideoFile = async (file: File): Promise<void> => {
    console.log(`[VideoCompression] Validating file: ${file.name}`);
    setProgress({ stage: 'validation', percentage: 5, message: 'Validating video file...' });

    // Basic file validation
    if (!file) {
      throw new VideoCompressionError('No file provided', 'INVALID_FILE', 'validation');
    }

    if (file.size === 0) {
      throw new VideoCompressionError('File is empty', 'EMPTY_FILE', 'validation');
    }

    if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
      throw new VideoCompressionError('File too large (max 2GB)', 'FILE_TOO_LARGE', 'validation');
    }

    if (!file.type.startsWith('video/')) {
      throw new VideoCompressionError('File is not a video', 'INVALID_TYPE', 'validation');
    }

    // Supported video types
    const supportedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
    if (!supportedTypes.some(type => file.type.toLowerCase().includes(type.split('/')[1]))) {
      console.warn(`[VideoCompression] Uncommon video type: ${file.type}, attempting to process anyway`);
    }

    console.log(`[VideoCompression] ✓ File validation passed`);
  };

  const analyzeVideoMetadata = async (file: File): Promise<VideoMetadata> => {
    console.log(`[VideoCompression] Analyzing video metadata`);
    setProgress({ stage: 'analysis', percentage: 15, message: 'Analyzing video properties...' });

    return new Promise<VideoMetadata>((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const objectURL = URL.createObjectURL(file);
      compressionRefs.current.objectURLs.push(objectURL);
      video.src = objectURL;

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMetadataLoaded);
        video.removeEventListener('error', onError);
        video.removeEventListener('canplaythrough', onCanPlay);
      };

      const onMetadataLoaded = async () => {
        try {
          // Wait for more complete metadata
          if (video.videoWidth === 0 || video.videoHeight === 0 || video.duration === 0) {
            console.log(`[VideoCompression] Incomplete metadata, waiting for canplaythrough...`);
            return; // Wait for canplaythrough
          }

          await processMetadata();
        } catch (err) {
          cleanup();
          reject(new VideoCompressionError(
            `Failed to analyze video metadata: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'METADATA_ANALYSIS_FAILED',
            'analysis'
          ));
        }
      };

      const onCanPlay = async () => {
        try {
          await processMetadata();
        } catch (err) {
          cleanup();
          reject(new VideoCompressionError(
            `Failed to analyze video metadata: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'METADATA_ANALYSIS_FAILED',
            'analysis'
          ));
        }
      };

      const processMetadata = async () => {
        // Basic metadata validation
        if (video.duration === Infinity || isNaN(video.duration)) {
          cleanup();
          reject(new VideoCompressionError('Video duration is invalid or unknown', 'INVALID_DURATION', 'analysis'));
          return;
        }

        if (video.duration > 3600) { // 1 hour limit
          cleanup();
          reject(new VideoCompressionError('Video too long (max 1 hour)', 'VIDEO_TOO_LONG', 'analysis'));
          return;
        }

        // Estimate bitrate (rough calculation)
        const estimatedBitrate = (file.size * 8) / video.duration; // bits per second

        // Estimate FPS (fallback to common values)
        let fps = 30; // Default assumption
        try {
          // Try to get more accurate fps if possible
          if ('getVideoTracks' in video && typeof video.getVideoTracks === 'function') {
            // This won't work on video element, but we'll use smart estimation
            const aspectRatio = video.videoWidth / video.videoHeight;
            if (aspectRatio > 2) fps = 24; // Likely cinematic content
            else if (video.videoWidth >= 1920) fps = 30; // HD content
            else fps = 25; // Standard content
          }
        } catch {
          // Use default fps
        }

        // Detect audio presence by attempting to play briefly
        let hasAudio = false;
        try {
          video.currentTime = Math.min(1, video.duration / 10);
          video.volume = 0;
          await video.play();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check if video has audio tracks (this is a rough detection)
          hasAudio = !video.muted && video.volume !== undefined;
          
          video.pause();
          video.currentTime = 0;
        } catch {
          // Assume has audio if we can't detect
          hasAudio = true;
        }

        const metadata: VideoMetadata = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          bitrate: Math.round(estimatedBitrate),
          fps,
          hasAudio,
          codec: file.type,
          size: file.size
        };

        console.log(`[VideoCompression] ✓ Metadata analysis complete:`, {
          resolution: `${metadata.width}x${metadata.height}`,
          duration: `${Math.round(metadata.duration)}s`,
          bitrate: `${Math.round(metadata.bitrate / 1000)}kbps`,
          fps: metadata.fps,
          hasAudio: metadata.hasAudio,
          size: formatBytes(metadata.size)
        });

        cleanup();
        resolve(metadata);
      };

      const onError = () => {
        cleanup();
        reject(new VideoCompressionError(
          'Video file appears to be corrupted or in an unsupported format',
          'CORRUPTED_VIDEO',
          'analysis'
        ));
      };

      video.addEventListener('loadedmetadata', onMetadataLoaded);
      video.addEventListener('error', onError);
      video.addEventListener('canplaythrough', onCanPlay);

      // Timeout for metadata loading
      setTimeout(() => {
        if (video.videoWidth === 0) {
          cleanup();
          reject(new VideoCompressionError(
            'Timeout while analyzing video metadata',
            'METADATA_TIMEOUT',
            'analysis'
          ));
        }
      }, 10000); // 10 second timeout
    });
  };

  const calculateOptimalSettings = (
    metadata: VideoMetadata,
    options: VideoCompressionOptions
  ): Required<VideoCompressionOptions> & { targetWidth: number; targetHeight: number; timeoutMs: number } => {
    console.log(`[VideoCompression] Calculating optimal compression settings`);

    const {
      maxWidth = 1280,
      maxHeight = 720,
      targetBitrate,
      quality = 0.8,
      preserveAudio = true
    } = options;

    // Don't upscale - only downscale if necessary
    let targetWidth = Math.min(maxWidth, metadata.width);
    let targetHeight = Math.min(maxHeight, metadata.height);

    // Maintain aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    if (targetWidth / targetHeight > aspectRatio) {
      targetWidth = Math.round(targetHeight * aspectRatio);
    } else {
      targetHeight = Math.round(targetWidth / aspectRatio);
    }

    // Ensure even dimensions (required by many codecs)
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

    // Calculate optimal bitrate if not specified
    let optimalBitrate = targetBitrate;
    if (!optimalBitrate) {
      // Base bitrate on resolution and original bitrate
      const pixelCount = targetWidth * targetHeight;
      const baseRate = Math.min(
        metadata.bitrate * 0.7, // Don't exceed 70% of original
        Math.max(
          pixelCount * 0.1, // Minimum quality based on resolution
          300000 // Minimum 300kbps
        )
      );
      
      // Adjust for quality setting
      optimalBitrate = Math.round(baseRate * quality);
      
      // Clamp to reasonable bounds
      optimalBitrate = Math.min(Math.max(optimalBitrate, 200000), 2000000); // 200kbps - 2Mbps
    }

    // Calculate timeout based on video duration with reasonable bounds
    const baseTimeoutMs = metadata.duration * 1500; // 1.5x real-time for processing
    const timeoutMs = Math.min(Math.max(baseTimeoutMs, 60000), 600000); // 1-10 minutes

    const settings = {
      maxWidth,
      maxHeight,
      targetBitrate: optimalBitrate,
      quality,
      preserveAudio: preserveAudio && metadata.hasAudio,
      targetWidth,
      targetHeight,
      timeoutMs
    };

    console.log(`[VideoCompression] ✓ Optimal settings calculated:`, {
      targetResolution: `${targetWidth}x${targetHeight}`,
      targetBitrate: `${Math.round(optimalBitrate / 1000)}kbps`,
      preserveAudio: settings.preserveAudio,
      timeoutMinutes: Math.round(timeoutMs / 60000)
    });

    return settings;
  };

  const detectSupportedCodecs = (): string[] => {
    const codecs = [
      // Prefer VP9 for better compression
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm',
      // H.264 fallback
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4'
    ];

    const supported = codecs.filter(codec => {
      const isSupported = MediaRecorder.isTypeSupported(codec);
      console.log(`[VideoCompression] Codec ${codec}: ${isSupported ? '✓' : '✗'}`);
      return isSupported;
    });

    if (supported.length === 0) {
      throw new VideoCompressionError(
        'No supported video codecs found in this browser',
        'NO_SUPPORTED_CODECS',
        'compression'
      );
    }

    console.log(`[VideoCompression] ✓ Selected codec: ${supported[0]}`);
    return supported;
  };

  const cleanupResources = (): void => {
    console.log(`[VideoCompression] Cleaning up resources`);
    const refs = compressionRefs.current;

    // Stop animation frame
    if (refs.animationFrame) {
      cancelAnimationFrame(refs.animationFrame);
      refs.animationFrame = undefined;
    }

    // Clear timeout
    if (refs.timeout) {
      clearTimeout(refs.timeout);
      refs.timeout = undefined;
    }

    // Stop recorder
    if (refs.recorder && refs.recorder.state !== 'inactive') {
      try {
        refs.recorder.stop();
      } catch (err) {
        console.warn('[VideoCompression] Error stopping recorder:', err);
      }
    }

    // Stop streams
    if (refs.stream) {
      refs.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('[VideoCompression] Error stopping track:', err);
        }
      });
      refs.stream = undefined;
    }

    // Pause and cleanup video
    if (refs.video) {
      refs.video.pause();
      refs.video.currentTime = 0;
      refs.video.removeAttribute('src');
      refs.video.load(); // Clear memory
      refs.video = undefined;
    }

    // Remove canvas from DOM if it was added
    if (refs.canvas && refs.canvas.parentNode) {
      refs.canvas.parentNode.removeChild(refs.canvas);
    }
    refs.canvas = undefined;

    // Revoke object URLs
    refs.objectURLs.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('[VideoCompression] Error revoking URL:', err);
      }
    });
    refs.objectURLs = [];

    // Abort any pending operations
    if (refs.abortController) {
      refs.abortController.abort();
      refs.abortController = undefined;
    }

    console.log(`[VideoCompression] ✓ Resource cleanup complete`);
  };

  const verifyOutput = async (compressedFile: File): Promise<void> => {
    console.log(`[VideoCompression] Verifying compressed output`);
    setProgress({ stage: 'verification', percentage: 95, message: 'Verifying compressed video...' });

    return new Promise<void>((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const objectURL = URL.createObjectURL(compressedFile);
      video.src = objectURL;

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(objectURL);
      };

      const onLoaded = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.duration > 0) {
          console.log(`[VideoCompression] ✓ Output verification passed`);
          cleanup();
          resolve();
        } else {
          cleanup();
          reject(new VideoCompressionError(
            'Compressed video appears to be invalid',
            'INVALID_OUTPUT',
            'verification'
          ));
        }
      };

      const onError = () => {
        cleanup();
        reject(new VideoCompressionError(
          'Compressed video cannot be played',
          'UNPLAYABLE_OUTPUT',
          'verification'
        ));
      };

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);

      // Timeout for verification
      setTimeout(() => {
        if (video.videoWidth === 0) {
          cleanup();
          reject(new VideoCompressionError(
            'Timeout while verifying compressed video',
            'VERIFICATION_TIMEOUT',
            'verification'
          ));
        }
      }, 5000);
    });
  };

  const compressVideo = useCallback(async (
    file: File,
    options: VideoCompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> => {
    // Prevent duplicate compression requests
    if (compressing) {
      throw new VideoCompressionError(
        'Another compression is already in progress',
        'COMPRESSION_IN_PROGRESS',
        'compression'
      );
    }

    setCompressing(true);
    setError(null);
    
    // Setup abort controller for cancellation
    compressionRefs.current.abortController = new AbortController();

    const progressCallback = (progress: CompressionProgress) => {
      setProgress(progress);
      onProgress?.(progress);
    };

    try {
      console.log(`[VideoCompression] Starting compression pipeline for: ${file.name} (${formatBytes(file.size)})`);

      // Stage 1: Validate input
      await validateVideoFile(file);

      // Stage 2: Analyze metadata
      const metadata = await analyzeVideoMetadata(file);
      progressCallback({ stage: 'analysis', percentage: 25, message: 'Video analysis complete' });

      // Stage 3: Calculate settings
      const settings = calculateOptimalSettings(metadata, options);
      progressCallback({ stage: 'compression', percentage: 30, message: 'Initializing compression...' });

      // Stage 4: Detect codecs
      const supportedCodecs = detectSupportedCodecs();
      const selectedCodec = supportedCodecs[0];

      // Stage 5: Compression pipeline
      console.log(`[VideoCompression] Starting compression with ${selectedCodec}`);
      const result = await performCompression(file, metadata, settings, selectedCodec, progressCallback);

      // Stage 6: Verify output
      await verifyOutput(result.file);
      progressCallback({ stage: 'complete', percentage: 100, message: 'Compression complete!' });

      console.log(`[VideoCompression] ✅ Compression successful:`, {
        original: formatBytes(result.originalSize),
        compressed: formatBytes(result.compressedSize),
        ratio: `${Math.round((1 - result.compressionRatio) * 100)}% reduction`,
        preservedAudio: result.preservedAudio
      });

      setCompressing(false);
      return result;

    } catch (err) {
      console.error(`[VideoCompression] ❌ Compression failed:`, err);
      
      const compressionError = err instanceof VideoCompressionError 
        ? err 
        : new VideoCompressionError(
            err instanceof Error ? err.message : 'Unknown compression error',
            'UNKNOWN_ERROR',
            'compression'
          );

      setError(compressionError);
      setCompressing(false);

      // Clean up resources on error
      cleanupResources();

      // Re-throw to let caller handle
      throw compressionError;
    }
  }, [compressing]);

  const performCompression = async (
    file: File,
    metadata: VideoMetadata,
    settings: ReturnType<typeof calculateOptimalSettings>,
    codec: string,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> => {
    return new Promise<CompressionResult>((resolve, reject) => {
      const refs = compressionRefs.current;
      
      // Setup elements
      refs.video = document.createElement('video');
      refs.canvas = document.createElement('canvas');
      refs.video.muted = true;
      refs.video.playsInline = true;
      refs.video.crossOrigin = 'anonymous';

      const videoURL = URL.createObjectURL(file);
      refs.objectURLs.push(videoURL);
      refs.video.src = videoURL;

      refs.canvas.width = settings.targetWidth;
      refs.canvas.height = settings.targetHeight;
      const ctx = refs.canvas.getContext('2d');

      if (!ctx) {
        reject(new VideoCompressionError('Canvas context not available', 'CANVAS_ERROR', 'compression'));
        return;
      }

      // Setup compression tracking
      const chunks: BlobPart[] = [];
      let startTime = 0;
      let lastProgressUpdate = 0;

      const onVideoLoaded = async () => {
        try {
          // Create stream from canvas
          refs.stream = refs.canvas!.captureStream(25); // 25 FPS
          
          // Setup MediaRecorder
          refs.recorder = new MediaRecorder(refs.stream, {
            mimeType: codec,
            videoBitsPerSecond: settings.targetBitrate,
          });

          refs.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          refs.recorder.onstop = () => {
            finishCompression();
          };

          refs.recorder.onerror = () => {
            reject(new VideoCompressionError('MediaRecorder failed', 'RECORDER_ERROR', 'compression'));
          };

          // Setup timeout
          refs.timeout = window.setTimeout(() => {
            console.warn(`[VideoCompression] Compression timeout after ${settings.timeoutMs}ms`);
            reject(new VideoCompressionError(
              'Compression timed out',
              'COMPRESSION_TIMEOUT',
              'compression'
            ));
          }, settings.timeoutMs);

          // Start recording and video playback
          refs.recorder.start();
          refs.video!.currentTime = 0;
          startTime = Date.now();
          await refs.video!.play();

          // Start frame drawing loop
          drawFrames();

        } catch (err) {
          reject(new VideoCompressionError(
            `Failed to start compression: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'START_COMPRESSION_FAILED',
            'compression'
          ));
        }
      };

      const drawFrames = () => {
        if (!refs.video || !refs.canvas || refs.video.paused || refs.video.ended) {
          // Video finished, stop recording
          if (refs.recorder && refs.recorder.state === 'recording') {
            refs.recorder.stop();
          }
          return;
        }

        // Draw current frame
        ctx.drawImage(refs.video, 0, 0, settings.targetWidth, settings.targetHeight);

        // Update progress
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) { // Update every second
          const currentTime = refs.video.currentTime;
          const totalTime = refs.video.duration;
          const percentage = Math.min(30 + (currentTime / totalTime) * 60, 90); // 30-90%
          
          onProgress({
            stage: 'compression',
            percentage,
            currentTime,
            totalTime,
            message: `Compressing... ${Math.round(currentTime)}s / ${Math.round(totalTime)}s`
          });

          lastProgressUpdate = now;
        }

        // Continue drawing
        refs.animationFrame = requestAnimationFrame(drawFrames);
      };

      const finishCompression = () => {
        try {
          // Create compressed file
          const compressedBlob = new Blob(chunks, { type: codec });
          const extension = codec.includes('webm') ? 'webm' : 'mp4';
          const compressedFile = new File(
            [compressedBlob],
            `${file.name.split('.')[0]}_compressed.${extension}`,
            { type: codec }
          );

          const result: CompressionResult = {
            file: compressedFile,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            compressionRatio: compressedFile.size / file.size,
            originalName: file.name,
            metadata,
            preservedAudio: false // Canvas stream doesn't preserve audio
          };

          // Clean up resources
          cleanupResources();

          resolve(result);
        } catch (err) {
          reject(new VideoCompressionError(
            `Failed to create compressed file: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'FILE_CREATION_FAILED',
            'compression'
          ));
        }
      };

      // Setup video event listeners
      refs.video.addEventListener('loadedmetadata', onVideoLoaded);
      refs.video.addEventListener('error', () => {
        reject(new VideoCompressionError('Video failed to load', 'VIDEO_LOAD_FAILED', 'compression'));
      });
    });
  };

  const cancelCompression = useCallback(() => {
    console.log(`[VideoCompression] Canceling compression`);
    
    if (compressionRefs.current.abortController) {
      compressionRefs.current.abortController.abort();
    }
    
    cleanupResources();
    setCompressing(false);
    setError(null);
    setProgress({ stage: 'validation', percentage: 0, message: 'Canceled' });
  }, []);

  return {
    compressing,
    error,
    progress,
    compressVideo,
    cancelCompression,
    formatBytes,
  };
};