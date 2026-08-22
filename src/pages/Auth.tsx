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

  // Get the intended destination from state or default to dashboard
  const from = (location.state as { from?: string })?.from || "/dashboard";

  // Redirect if already logged in (Supabase auth only)
  // Also check if Face Hub session exists and redirect to face-hub
  useEffect(() => {
    // Check Face Hub session first
    const localAuth = localStorage.getItem("faceAttendanceAuth") === "true";
    const sessionAuth = sessionStorage.getItem("faceAttendanceAuth") === "true";
    
    if (localAuth || sessionAuth) {
      console.log("[Auth] Face Hub session detected, redirecting to /face-hub");
      navigate("/face-hub", { replace: true });
      return;
    }

    // Then check Supabase auth
    if (!loading && user && role) {
      navigate(from, { replace: true });
    }
  }, [user, role, loading, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
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

      // Check if it's face attendance hub credentials
      if (
        loginEmail.toLowerCase() === "face@wazireducationsocity.com" &&
        loginPassword === "WES@12345"
      ) {
        try {
          // Create session in database - location is strictly mandatory
          const sessionToken = await createFaceSession();
          
          // Store session permanently in localStorage and sessionStorage
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
          
          // Also set sessionStorage as backup
          sessionStorage.setItem("faceAttendanceAuth", "true");
          sessionStorage.setItem("faceSessionToken", sessionToken);
          sessionStorage.setItem("faceSessionCreatedAt", Date.now().toString());
          
          toast({
            title: "Face Attendance Access",
            description: "Location verified! Redirecting to face hub...",
          });
          setTimeout(() => {
            navigate("/face-hub");
          }, 500);
          return;
        } catch (locErr: any) {
          console.error("[Auth] Face session error:", locErr);
          toast({
            title: "Location Permission Required",
            description: locErr.message || "Face Hub requires GPS location permission to log in. Please enable location services.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
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
        </CardHeader>
        <CardContent>
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

          <p className="text-xs text-muted-foreground text-center mt-4">
            Contact your administrator if you need an account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
