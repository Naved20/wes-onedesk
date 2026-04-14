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
import Documents from "./pages/Documents";
import Performance from "./pages/Performance";
import Announcements from "./pages/Announcements";
import Institutions from "./pages/Institutions";
import Settings from "./pages/Settings";
import ShiftManagement from "./pages/ShiftManagement";
import EmployeeShiftAssignment from "./pages/EmployeeShiftAssignment";
import GoogleDrive from "./pages/GoogleDrive";
import Tasks from "./pages/Tasks";
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Employees /></ProtectedRoute>} />
            <Route path="/employee/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
            <Route path="/salaries" element={<ProtectedRoute><Salaries /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute allowedRoles={["admin"]}><ShiftManagement /></ProtectedRoute>} />
            <Route path="/shift-assignments" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><EmployeeShiftAssignment /></ProtectedRoute>} />
            <Route path="/institutions" element={<ProtectedRoute allowedRoles={["admin"]}><Institutions /></ProtectedRoute>} />
            <Route path="/google-drive" element={<ProtectedRoute><GoogleDrive /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
