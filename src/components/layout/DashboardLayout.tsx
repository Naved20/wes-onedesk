import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import wesLogo from "@/assets/wes-logo.jpg";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Clock,
  DollarSign,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Building,
  Star,
  Megaphone,
  UserCircle,
  Cloud,
  CheckSquare,
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
  { label: "Salaries", href: "/salaries", icon: <DollarSign className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Documents", href: "/documents", icon: <FileText className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Performance", href: "/performance", icon: <Star className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Announcements", href: "/announcements", icon: <Megaphone className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Tasks", href: "/tasks", icon: <CheckSquare className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Google Drive", href: "/google-drive", icon: <Cloud className="h-5 w-5" />, roles: ["admin", "manager", "employee"] },
  { label: "Shift Management", href: "/shifts", icon: <Clock className="h-5 w-5" />, roles: ["admin"] },
  { label: "Shift Assignments", href: "/shift-assignments", icon: <Users className="h-5 w-5" />, roles: ["admin", "manager"] },
  { label: "Institutions", href: "/institutions", icon: <Building className="h-5 w-5" />, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, roles: ["admin"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("employee_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setMyProfileId(data.id);
        });
    }
  }, [user?.id]);

  const filteredNavItems = navItems.filter((item) => 
    role && item.roles.includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

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
          <h1 className="font-semibold text-lg">WES OneDesk</h1>
        </div>
        <div className="w-10" />
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
            <img src={wesLogo} alt="WES Foundation" className="h-10 w-10 rounded-full object-cover" />
            <h1 className="font-bold text-xl text-primary">WES OneDesk</h1>
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
            <div className="flex items-center mb-3">
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
            {myProfileId && (
              <Button
                variant="outline"
                className="w-full justify-start mb-2"
                onClick={() => {
                  navigate(`/employee/${myProfileId}`);
                  setSidebarOpen(false);
                }}
              >
                <UserCircle className="h-4 w-4 mr-2" />
                My Profile
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "lg:ml-64 min-h-screen",
        "pt-16 lg:pt-0"
      )}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
