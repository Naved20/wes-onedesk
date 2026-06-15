/**
 * Custom hook for Face Hub authentication
 * Separate from Supabase auth - uses localStorage/sessionStorage only
 */

export function useFaceAuth() {
  const isFaceAuthenticated = (): boolean => {
    const localAuth = localStorage.getItem("faceAttendanceAuth") === "true";
    const sessionAuth = sessionStorage.getItem("faceAttendanceAuth") === "true";
    return localAuth || sessionAuth;
  };

  const getFaceSessionToken = (): string | null => {
    return (
      localStorage.getItem("faceSessionToken") ||
      sessionStorage.getItem("faceSessionToken")
    );
  };

  const syncAuthStorage = (): void => {
    const localAuth = localStorage.getItem("faceAttendanceAuth") === "true";
    const sessionAuth = sessionStorage.getItem("faceAttendanceAuth") === "true";

    if (localAuth && !sessionAuth) {
      sessionStorage.setItem("faceAttendanceAuth", "true");
      const token = localStorage.getItem("faceSessionToken");
      if (token) sessionStorage.setItem("faceSessionToken", token);
    } else if (sessionAuth && !localAuth) {
      localStorage.setItem("faceAttendanceAuth", "true");
      const token = sessionStorage.getItem("faceSessionToken");
      if (token) localStorage.setItem("faceSessionToken", token);
    }
  };

  const clearFaceAuth = (): void => {
    localStorage.removeItem("faceAttendanceAuth");
    localStorage.removeItem("faceSessionToken");
    localStorage.removeItem("faceSessionCreatedAt");
    localStorage.removeItem("faceAuthData");
    sessionStorage.removeItem("faceAttendanceAuth");
    sessionStorage.removeItem("faceSessionToken");
    sessionStorage.removeItem("faceSessionCreatedAt");
  };

  return {
    isFaceAuthenticated,
    getFaceSessionToken,
    syncAuthStorage,
    clearFaceAuth,
  };
}
