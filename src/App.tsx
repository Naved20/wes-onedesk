import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeProfile from "./pages/EmployeeProfile";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Salaries from "./pages/Salaries";
import SalarySlip from "./pages/SalarySlip";
import Documents from "./pages/Documents";
import Performance from "./pages/Performance";
import Announcements from "./pages/Announcements";
import Institutions from "./pages/Institutions";
import Settings from "./pages/Settings";
import AccountInfo from "./pages/settings/AccountInfo";
import ChangePassword from "./pages/settings/ChangePassword";
import Notifications from "./pages/settings/Notifications";
import Privacy from "./pages/settings/Privacy";
import Appearance from "./pages/settings/Appearance";
import Language from "./pages/settings/Language";
import SupportRequests from "./pages/settings/SupportRequests";
import ShiftManagement from "./pages/ShiftManagement";
import EmployeeShiftAssignment from "./pages/EmployeeShiftAssignment";
import Tasks from "./pages/Tasks";
import { EarningsAnalyticsPage } from "./pages/EarningsAnalytics";
import PeerReviewerGroups from "./pages/PeerReviewerGroups";
import AssignmentGroups from "./pages/AssignmentGroups";
import QuickLinksAdmin from "./pages/QuickLinksAdmin";
import FaceAttendance from "./pages/FaceAttendance";
import FaceHub from "./pages/FaceHub";
import FaceIdManagement from "./pages/FaceIdManagement";
import FaceAttendanceSessions from "./pages/FaceAttendanceSessions";
import FaceCheckinHistory from "./pages/FaceCheckinHistory";
import WESTeacherReports from "./pages/WESTeacherReports";
import WESWeeklyReportForm from "./pages/WESWeeklyReportForm";
import UploadedReports from "./pages/UploadedReports";
import ActivityLogs from "./pages/ActivityLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/face-attendance" element={<FaceAttendance />} />
            <Route path="/face-hub" element={<FaceHub />} />
            <Route path="/face-id-management" element={<ProtectedRoute allowedRoles={["admin"]}><FaceIdManagement /></ProtectedRoute>} />
            <Route path="/face-sessions" element={<ProtectedRoute allowedRoles={["admin"]}><FaceAttendanceSessions /></ProtectedRoute>} />
            <Route path="/face-attendance-history" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><FaceCheckinHistory /></ProtectedRoute>} />
            <Route path="/face-history" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><FaceCheckinHistory /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Employees /></ProtectedRoute>} />
            <Route path="/employee/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
            <Route path="/salaries" element={<ProtectedRoute><Salaries /></ProtectedRoute>} />
            <Route path="/salary-slip" element={<ProtectedRoute><SalarySlip /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute allowedRoles={["admin"]}><ShiftManagement /></ProtectedRoute>} />
            <Route path="/shift-assignments" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><EmployeeShiftAssignment /></ProtectedRoute>} />
            <Route path="/institutions" element={<ProtectedRoute allowedRoles={["admin"]}><Institutions /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/support-requests" element={<ProtectedRoute><SupportRequests /></ProtectedRoute>} />
            <Route path="/earnings-analytics" element={<ProtectedRoute allowedRoles={["admin"]}><EarningsAnalyticsPage /></ProtectedRoute>} />
            <Route path="/peer-reviewer-groups" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><PeerReviewerGroups /></ProtectedRoute>} />
            <Route path="/assignment-groups" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><AssignmentGroups /></ProtectedRoute>} />
            <Route path="/quick-links" element={<ProtectedRoute allowedRoles={["admin"]}><QuickLinksAdmin /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/account" element={<ProtectedRoute><AccountInfo /></ProtectedRoute>} />
            <Route path="/settings/password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/settings/support" element={<ProtectedRoute><SupportRequests /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/settings/privacy" element={<ProtectedRoute><Privacy /></ProtectedRoute>} />
            <Route path="/settings/appearance" element={<ProtectedRoute><Appearance /></ProtectedRoute>} />
            <Route path="/settings/language" element={<ProtectedRoute><Language /></ProtectedRoute>} />
            <Route path="/wes-reports" element={<ProtectedRoute><WESTeacherReports /></ProtectedRoute>} />
            <Route path="/wes-reports/:reportId" element={<ProtectedRoute><WESWeeklyReportForm /></ProtectedRoute>} />
            <Route path="/uploaded-reports" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><UploadedReports /></ProtectedRoute>} />
            <Route path="/activity-logs" element={<ProtectedRoute allowedRoles={["admin"]}><ActivityLogs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;


