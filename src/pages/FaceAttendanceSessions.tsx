import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  LogOut, 
  RefreshCw, 
  Clock,
  MapPin,
  Chrome,
  Globe
} from "lucide-react";
import { getAllSessions, adminLogoutSession } from "@/lib/faceSessionManager";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Session {
  id: string;
  session_token: string;
  device_info: any;
  ip_address: string | null;
  user_agent: string | null;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_address: string | null;
  login_time: string;
  last_activity: string;
  logout_time: string | null;
  is_active: boolean;
  logout_reason: string | null;
}

export default function FaceAttendanceSessions() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [processingLogout, setProcessingLogout] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard");
      return;
    }
    fetchSessions();
  }, [role, navigate]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async () => {
    if (!selectedSession) return;

    setProcessingLogout(true);
    try {
      const success = await adminLogoutSession(selectedSession.session_token);
      if (success) {
        toast({
          title: "Session Logged Out",
          description: "The device has been logged out successfully",
        });
        fetchSessions();
      } else {
        throw new Error("Failed to logout session");
      }
    } catch (error) {
      console.error("Error logging out session:", error);
      toast({
        title: "Error",
        description: "Failed to logout session",
        variant: "destructive",
      });
    } finally {
      setProcessingLogout(false);
      setLogoutDialogOpen(false);
      setSelectedSession(null);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const activeSessions = sessions.filter(s => s.is_active);
  const inactiveSessions = sessions.filter(s => !s.is_active);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Face Attendance Sessions</h1>
            <p className="text-muted-foreground">Monitor and manage all Face Hub login sessions</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-4 py-2">
              Active: {activeSessions.length}
            </Badge>
            <Button onClick={fetchSessions} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              Active Sessions ({activeSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active sessions
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(session.device_type)}
                            <span className="font-medium">{session.device_type || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Chrome className="h-3.5 w-3.5 text-muted-foreground" />
                            {session.browser_name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>{session.os_name || "Unknown"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {session.ip_address || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          {session.latitude && session.longitude ? (
                            <div className="space-y-1">
                              <a
                                href={`https://www.google.com/maps?q=${session.latitude},${session.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <MapPin className="h-3 w-3" />
                                View on Map
                              </a>
                              {session.location_address && (
                                <p className="text-xs text-muted-foreground truncate" title={session.location_address}>
                                  {session.location_address}
                                </p>
                              )}
                              {session.location_accuracy && (
                                <p className="text-xs text-muted-foreground">
                                  ±{Math.round(session.location_accuracy)}m
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not available</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(session.login_time), "MMM dd, yyyy hh:mm a")}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            {formatDistanceToNow(new Date(session.login_time))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(session);
                              setLogoutDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Logout
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Inactive Sessions ({inactiveSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inactiveSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No inactive sessions
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Logout Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveSessions.map((session) => (
                      <TableRow key={session.id} className="opacity-60">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(session.device_type)}
                            <span>{session.device_type || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{session.browser_name || "Unknown"}</TableCell>
                        <TableCell>{session.os_name || "Unknown"}</TableCell>
                        <TableCell>{session.ip_address || "Unknown"}</TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          {session.latitude && session.longitude ? (
                            <div className="space-y-1">
                              <a
                                href={`https://www.google.com/maps?q=${session.latitude},${session.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                              >
                                <MapPin className="h-3 w-3" />
                                Map
                              </a>
                              {session.location_address && (
                                <p className="text-xs text-muted-foreground truncate" title={session.location_address}>
                                  {session.location_address.split(',').slice(0, 2).join(',')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(session.login_time), "MMM dd, yyyy hh:mm a")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.logout_time
                            ? format(new Date(session.logout_time), "MMM dd, yyyy hh:mm a")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {session.logout_time && (
                            <Badge variant="secondary">
                              {formatDistanceToNow(new Date(session.login_time), {
                                includeSeconds: false,
                              })}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.logout_reason || "Unknown"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout this device? The user will need to login again to access Face Attendance Hub.
              {selectedSession && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-1 text-sm">
                  <p><strong>Device:</strong> {selectedSession.device_type}</p>
                  <p><strong>Browser:</strong> {selectedSession.browser_name}</p>
                  <p><strong>IP:</strong> {selectedSession.ip_address}</p>
                  {selectedSession.latitude && selectedSession.longitude && (
                    <>
                      <p><strong>Location:</strong> {selectedSession.latitude.toFixed(6)}, {selectedSession.longitude.toFixed(6)}</p>
                      {selectedSession.location_address && (
                        <p className="text-xs text-muted-foreground">{selectedSession.location_address}</p>
                      )}
                    </>
                  )}
                  <p><strong>Login:</strong> {format(new Date(selectedSession.login_time), "MMM dd, yyyy hh:mm a")}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingLogout}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutSession}
              disabled={processingLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processingLogout ? "Logging out..." : "Logout Device"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
