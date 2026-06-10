/**
 * Audio Notification Utility
 * Plays notification sounds for different events
 */

export type NotificationSoundType = "success" | "warning" | "error" | "info" | "default";

class AudioNotificationManager {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  private async initAudioContext() {
    if (this.isInitialized) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize AudioContext:", error);
    }
  }

  /**
   * Play a simple beep sound using Web Audio API
   * Different frequencies for different notification types
   */
  public async playNotificationSound(type: NotificationSoundType = "default") {
    try {
      await this.initAudioContext();
      if (!this.audioContext) return;

      // Resume audio context if suspended (required by browser autoplay policy)
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const masterVolume = this.audioContext.createGain();
      masterVolume.connect(this.audioContext.destination);
      masterVolume.gain.value = 0.3; // 30% volume to not startle users

      switch (type) {
        case "success":
          // Success: C major chord (uplifting)
          this.playTone(261.63, 0.1, now, masterVolume); // C
          this.playTone(329.63, 0.1, now + 0.05, masterVolume); // E
          this.playTone(392.0, 0.15, now + 0.1, masterVolume); // G
          break;

        case "warning":
          // Warning: Double beep at lower frequency
          this.playTone(440, 0.1, now, masterVolume); // A
          this.playTone(440, 0.1, now + 0.15, masterVolume); // A
          break;

        case "error":
          // Error: Descending tones
          this.playTone(494.0, 0.1, now, masterVolume); // B
          this.playTone(392.0, 0.1, now + 0.1, masterVolume); // G
          this.playTone(329.63, 0.15, now + 0.2, masterVolume); // E
          break;

        case "info":
          // Info: Single clear tone
          this.playTone(523.25, 0.2, now, masterVolume); // C5
          break;

        case "default":
        default:
          // Default: Soft notification tone
          this.playTone(440, 0.15, now, masterVolume); // A
          break;
      }
    } catch (error) {
      console.error("Error playing notification sound:", error);
      // Fallback to browser notification API sound if Web Audio API fails
      this.fallbackNotificationSound();
    }
  }

  /**
   * Play a tone using oscillator
   */
  private playTone(frequency: number, duration: number, startTime: number, destination: AudioNode) {
    const oscillator = this.audioContext!.createOscillator();
    const envelope = this.audioContext!.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    // ADSR-like envelope
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.02); // Attack
    envelope.gain.linearRampToValueAtTime(0.7, startTime + duration * 0.5); // Decay
    envelope.gain.linearRampToValueAtTime(0, startTime + duration); // Release

    oscillator.connect(envelope);
    envelope.connect(destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  /**
   * Fallback: Use Notification API sound if available
   */
  private fallbackNotificationSound() {
    // Most browsers have a default notification sound
    // This is just a visual indicator that a notification occurred
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        // The browser will play its default notification sound
        new Notification("Notification", {
          tag: "audio-test", // Prevent duplicate notifications
          requireInteraction: false,
        });
      }
    } catch (error) {
      console.debug("Notification API fallback not available");
    }
  }
}

// Export singleton instance
export const audioNotificationManager = new AudioNotificationManager();

/**
 * Helper function to play sound based on notification type
 */
export function playNotificationSound(notificationType: string) {
  let soundType: NotificationSoundType = "default";

  if (notificationType.includes("approved") || notificationType.includes("completed")) {
    soundType = "success";
  } else if (notificationType.includes("rejected") || notificationType.includes("error")) {
    soundType = "error";
  } else if (notificationType.includes("pending") || notificationType.includes("warning")) {
    soundType = "warning";
  } else {
    soundType = "info";
  }

  audioNotificationManager.playNotificationSound(soundType);
}
