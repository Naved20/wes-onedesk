import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Camera, Lock } from "lucide-react";
import { createFaceSession } from "@/lib/faceSessionManager";

export default function FaceAttendanceAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate credentials
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter username and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Check credentials
      // Format: face@wes.lu / WES@naved123
      const validCredentials = {
        username: "face@wes.lu",
        password: "WES@naved123",
      };

      if (
        credentials.username.toLowerCase() === validCredentials.username.toLowerCase() &&
        credentials.password === validCredentials.password
      ) {
        try {
          // Create session in database (location check is mandatory)
          const sessionToken = await createFaceSession();
          
          // Store session permanently in localStorage (unlimited duration)
          // Also use sessionStorage as backup fallback
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
          
          // Also set sessionStorage as backup
          sessionStorage.setItem("faceAttendanceAuth", "true");
          sessionStorage.setItem("faceSessionToken", sessionToken);
          sessionStorage.setItem("faceSessionCreatedAt", Date.now().toString());
          
          toast({
            title: "Login Successful",
            description: "Location verified! Redirecting to face attendance...",
          });

          // Redirect to face attendance
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
          return;
        }
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
            Enter your credentials to access the face attendance system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="face@wes.lu"
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
                  Logging in...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Access Face Attendance
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <Lock className="inline h-4 w-4 mr-1" />
              Secure access for face recognition system
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
