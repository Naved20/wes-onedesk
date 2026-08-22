import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Camera, Lock, KeyRound, ArrowLeft, ShieldCheck } from "lucide-react";
import { createFaceSession } from "@/lib/faceSessionManager";
import { verifyFaceOtp } from "@/lib/faceOtpManager";

export default function FaceAttendanceAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  // OTP Step states
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Check if session already exists
  useEffect(() => {
    const localAuth = localStorage.getItem("faceAttendanceAuth") === "true";
    const sessionAuth = sessionStorage.getItem("faceAttendanceAuth") === "true";
    
    if (localAuth || sessionAuth) {
      console.log("[FaceAttendanceAuth] Session found, redirecting to /face-attendance");
      navigate("/face-attendance", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validCredentials = {
        username: "facehub",
        password: "wes@attendance2025"
      };

      if (
        credentials.username.toLowerCase() === validCredentials.username.toLowerCase() &&
        credentials.password === validCredentials.password
      ) {
        await generateNewFaceOtp();
        setShowOtpStep(true);
        setLoading(false);
        toast({
          title: "Security Step 2 Required",
          description: "Credentials verified! Please enter the active 60-second OTP from Admin Dashboard.",
        });
        return;
      } else {
        toast({
          title: "Invalid Credentials",
          description: "Please check your username and password",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the complete 6-digit OTP code.",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      const otpRes = await verifyFaceOtp(otpCode);
      if (!otpRes.valid) {
        toast({
          title: "OTP Verification Failed",
          description: otpRes.message,
          variant: "destructive",
        });
        setVerifyingOtp(false);
        return;
      }

      const sessionToken = await createFaceSession();
      
      const authData = {
        auth: "true",
        token: sessionToken,
        timestamp: Date.now().toString(),
        username: credentials.username
      };
      
      localStorage.setItem("faceAttendanceAuth", "true");
      localStorage.setItem("faceSessionToken", sessionToken);
      localStorage.setItem("faceSessionCreatedAt", Date.now().toString());
      localStorage.setItem("faceAuthData", JSON.stringify(authData));
      
      sessionStorage.setItem("faceAttendanceAuth", "true");
      sessionStorage.setItem("faceSessionToken", sessionToken);
      sessionStorage.setItem("faceSessionCreatedAt", Date.now().toString());
      
      toast({
        title: "Login Successful",
        description: "OTP & Location verified! Redirecting...",
      });

      setTimeout(() => {
        navigate("/face-attendance");
      }, 500);
    } catch (locErr: any) {
      console.error("Location or session creation error:", locErr);
      toast({
        title: "Location Permission Required",
        description: locErr.message || "GPS Location permission is mandatory to access Face Attendance.",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Camera className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Face Recognition Attendance</CardTitle>
          <CardDescription>
            {showOtpStep ? "Step 2: Enter Admin 60-Second Security OTP" : "Enter your credentials to access the face attendance system"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showOtpStep ? (
            <form onSubmit={handleOtpVerifyAndLogin} className="space-y-4">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3 text-xs text-primary">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>Username & Password verified! Enter the active 6-digit OTP code from the Admin Dashboard.</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp-code">6-Digit Admin Security OTP</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-9 tracking-widest text-lg font-mono"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The OTP changes every 60 seconds on <b>Admin Dashboard &gt; Active Sessions</b>.
                </p>
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={verifyingOtp}>
                {verifyingOtp ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-spin" /> Verifying OTP & GPS...
                  </>
                ) : (
                  "Verify OTP & Access System"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setShowOtpStep(false);
                  setOtpCode("");
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Password
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="facehub"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-pulse" />
                    Checking Credentials...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Access Face Attendance
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <Lock className="inline h-4 w-4 mr-1" />
              Secure 2-Factor GPS-enabled access for face recognition system
            </p>
          </div>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/auth")}
              className="text-sm"
            >
              Back to Main Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
