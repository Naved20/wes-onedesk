import { useCallback, useState } from 'react';

export const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeechSupported] = useState(() => {
    return typeof window !== 'undefined' && ('speechSynthesis' in window);
  });

  const speak = useCallback((text: string, language: string = 'en-US') => {
    if (!isSpeechSupported) {
      console.warn('Speech Synthesis not supported in this browser');
      return;
    }

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1; // Normal speed
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, [isSpeechSupported]);

  const stop = useCallback(() => {
    if (isSpeechSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, [isSpeechSupported]);

  return { speak, stop, isPlaying, isSpeechSupported };
};
