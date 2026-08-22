import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import wesLogo from "@/assets/wes-logo.jpg";
import { createFaceSession } from "@/lib/faceSessionManager";
import { verifyFaceOtp } from "@/lib/faceOtpManager";
import { KeyRound, ArrowLeft, ShieldCheck, Lock } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signIn, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // OTP Step states for Face Hub
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Get the intended destination from state or default to dashboard
  const from = (location.state as { from?: string })?.from || "/dashboard";

  // Redirect if already logged in (Supabase auth only)
  useEffect(() => {
    const localAuth = localStorage.getItem("faceAttendanceAuth") === "true";
    const sessionAuth = sessionStorage.getItem("faceAttendanceAuth") === "true";
    
    if (localAuth || sessionAuth) {
      console.log("[Auth] Face Hub session detected, redirecting to /face-hub");
      navigate("/face-hub", { replace: true });
      return;
    }

    if (!loading && user && role) {
      navigate(from, { replace: true });
    }
  }, [user, role, loading, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const trimmedInput = loginEmail.trim().toLowerCase();
      const trimmedPass = loginPassword.trim();

      const validFaceUsers = ["face@wazireducationsocity.com", "face@wes.lu", "facehub", "face@wes.com"];
      const validFacePasses = ["WES@12345", "WES@naved123", "wes@attendance2025"];

      // Check if it's face attendance hub credentials
      if (validFaceUsers.includes(trimmedInput) && validFacePasses.includes(trimmedPass)) {
        // Trigger fresh OTP generation for this login request
        try {
          await generateNewFaceOtp();
        } catch (otpErr) {
          console.warn("[Auth] OTP generation warning:", otpErr);
        }
        setShowOtpStep(true);
        setIsLoading(false);
        toast({
          title: "Security Step 2 Required",
          description: "Password verified! Please enter the active 60-second OTP from Admin Dashboard.",
        });
        return;
      }

      const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Normal login flow
      const { error } = await signIn(loginEmail.trim(), loginPassword);
      
      if (error) {
        toast({
          title: "Login Failed",
          description: error.message || "Invalid email or password",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

      // OTP Verified! Now verify GPS location & create session
      const sessionToken = await createFaceSession();
      
      const authData = {
        auth: "true",
        token: sessionToken,
        timestamp: Date.now().toString(),
        email: loginEmail
      };
      
      localStorage.setItem("faceAttendanceAuth", "true");
      localStorage.setItem("faceSessionToken", sessionToken);
      localStorage.setItem("faceSessionCreatedAt", Date.now().toString());
      localStorage.setItem("faceAuthData", JSON.stringify(authData));
      
      sessionStorage.setItem("faceAttendanceAuth", "true");
      sessionStorage.setItem("faceSessionToken", sessionToken);
      sessionStorage.setItem("faceSessionCreatedAt", Date.now().toString());
      
      toast({
        title: "OTP & Location Verified",
        description: "Access granted! Redirecting to Face Hub...",
      });
      
      setTimeout(() => {
        navigate("/face-hub");
      }, 500);
    } catch (locErr: any) {
      console.error("[Auth] Face session/location error:", locErr);
      toast({
        title: "Location Permission Required",
        description: locErr.message || "Face Hub requires GPS location permission to log in. Please enable location services.",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={wesLogo} alt="WES Foundation" className="h-20 w-20 rounded-full object-cover" />
          </div>
          <CardTitle className="text-2xl font-bold">WES OneDesk</CardTitle>
          <CardDescription>
            {showOtpStep ? "Step 2: Admin Security OTP Verification" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {showOtpStep ? (
            <form onSubmit={handleOtpVerifyAndLogin} className="space-y-4">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3 text-xs text-primary">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>Password verified! Please enter the 6-digit OTP code currently active on the Admin Dashboard.</span>
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
                  The OTP updates every 60 seconds on <b>Admin Dashboard &gt; Active Sessions</b>.
                </p>
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={verifyingOtp}>
                {verifyingOtp ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-spin" /> Verifying OTP & GPS Location...
                  </>
                ) : (
                  "Verify OTP & Access Face Hub"
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
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            Contact your administrator if you need an account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
