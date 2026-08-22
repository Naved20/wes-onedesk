import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import wesLogo from "@/assets/wes-logo.jpg";
import { NotificationBell } from "@/components/NotificationBell";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Clock,
  DollarSign,
  Settings,
  Menu,
  X,
  Star,
  Megaphone,
  CheckSquare,
  ScanFace,
  UserCheck,
  HelpCircle,
  BookOpen,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Employees", href: "/employees", icon: <Users className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Attendance", href: "/attendance", icon: <Clock className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Leaves", href: "/leaves", icon: <Calendar className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Salary and Earning", href: "/salaries", icon: <DollarSign className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Policy and Procedures", href: "/documents", icon: <FileText className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Performance", href: "/performance", icon: <Star className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Reports", href: "/wes-reports", icon: <BookOpen className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Uploaded Reports", href: "/uploaded-reports", icon: <FileText className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Announcements", href: "/announcements", icon: <Megaphone className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Training", href: "/tasks", icon: <CheckSquare className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Support & Requests", href: "/support-requests", icon: <HelpCircle className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Peer Reviewer Groups", href: "/peer-reviewer-groups", icon: <Users className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Assignment Groups", href: "/assignment-groups", icon: <UserCheck className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Shift Management", href: "/shifts", icon: <Clock className="h-5 w-5" />, roles: ["admin"] },
  { label: "Shift Assignments", href: "/shift-assignments", icon: <Users className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Face ID Management", href: "/face-id-management", icon: <ScanFace className="h-5 w-5" />, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) =>
    role && item.roles.includes(role)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 bg-card border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <div className="flex items-center gap-2">
          <img src={wesLogo} alt="WES Foundation" className="h-8 w-8 rounded-full object-cover" />
                      <div className="flex flex-col leading-tight">
              <h1 className="font-bold text-xl text-primary">WES OneDesk</h1>
              <span className="text-[10px] text-muted-foreground font-medium">
                v 2.8.22.12
              </span>
            </div>
        </div>
        <NotificationBell />
        
      </header>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r transition-transform duration-300",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
         <div className="flex items-center h-16 px-6 border-b gap-3">
            <img
              src={wesLogo}
              alt="WES Foundation"
              className="h-10 w-10 rounded-full object-cover"
            />

            <div className="flex flex-col leading-tight">
              <h1 className="font-bold text-xl text-primary">WES OneDesk</h1>
              <span className="text-[10px] text-muted-foreground font-medium">
                v 2.8.22.12
              </span>
            </div>
        </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <ul className="space-y-1">
              {filteredNavItems.map((item) => (
                <li key={item.href}>
                  <button
                    onClick={() => {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      location.pathname === item.href
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.icon}
                    <span className="ml-3">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t p-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "lg:ml-64 min-h-screen relative",
        "pt-16 lg:pt-0"
      )}>
        {/* Desktop floating notification bell */}
        <div className="hidden lg:flex absolute top-4 right-6 z-30">
          <NotificationBell />
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
