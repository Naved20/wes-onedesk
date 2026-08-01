/**
 * Audio feedback utility for task operations
 * Provides beep sounds for success and error notifications
 */

// Create audio context for beep generation
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play a beep sound with specified frequency and duration
 */
const playBeep = (frequency: number, duration: number, volume: number = 0.3) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    console.warn('Audio playback failed:', error);
  }
};

/**
 * Play success beep sound (pleasant, higher pitch)
 * Two-tone confirmation beep
 */
export const playSuccessBeep = () => {
  try {
    // First beep (middle C)
    playBeep(523.25, 0.1, 0.2);
    
    // Second beep (higher, after short delay)
    setTimeout(() => {
      playBeep(659.25, 0.15, 0.25);
    }, 120);
  } catch (error) {
    console.warn('Success beep failed:', error);
  }
};

/**
 * Play error beep sound (lower pitch, attention-grabbing)
 * Single lower tone
 */
export const playErrorBeep = () => {
  try {
    // Single lower beep
    playBeep(200, 0.3, 0.3);
  } catch (error) {
    console.warn('Error beep failed:', error);
  }
};

/**
 * Play warning beep sound (medium pitch)
 * Single medium tone
 */
export const playWarningBeep = () => {
  try {
    playBeep(400, 0.2, 0.25);
  } catch (error) {
    console.warn('Warning beep failed:', error);
  }
};

/**
 * Play processing/start beep (short, neutral)
 */
export const playProcessingBeep = () => {
  try {
    playBeep(440, 0.1, 0.15);
  } catch (error) {
    console.warn('Processing beep failed:', error);
  }
};
