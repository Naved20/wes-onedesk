// Browser speech synthesis helper
export const speak = (text: string, lang = "en-IN") => {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.error("Speech synthesis failed:", e);
  }
};

export const speakAttendanceEnrolled = (name: string) => {
  speak(`Your attendance enrolled, ${name}`);
};
