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

export const speakAlreadyCheckedIn = (name: string, formattedTime?: string) => {
  if (formattedTime) {
    speak(`${name}, your attendance for today was already marked at ${formattedTime}`);
  } else {
    speak(`${name}, your attendance for today was already marked`);
  }
};

export const speakCheckoutSuccess = (name: string, durationStr?: string) => {
  if (durationStr) {
    speak(`Thank you ${name}, your check-out is marked. Total working time ${durationStr}. Have a great day!`);
  } else {
    speak(`Thank you ${name}, your check-out is marked. Have a great day!`);
  }
};

export const speakNotCheckedIn = (name: string) => {
  speak(`${name}, you are not checked in today. Please check in first.`);
};

export const speakAlreadyCheckedOut = (name: string, formattedTime?: string) => {
  if (formattedTime) {
    speak(`${name}, you have already checked out today at ${formattedTime}`);
  } else {
    speak(`${name}, you have already checked out today`);
  }
};

