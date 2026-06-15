import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Lock, User, Bell, Shield, Palette, Globe, ChevronRight, UserCircle, LogOut, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SettingsMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  href?: string;
  action?: () => void;
  variant?: "default" | "danger";
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfileId = async () => {
      if (user?.id) {
        setLoadingProfile(true);
        try {
          const { data } = await supabase
            .from("employee_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (data) setMyProfileId(data.id);
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          setLoadingProfile(false);
        }
      }
    };
    
    fetchProfileId();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleProfileClick = () => {
    if (myProfileId) {
      navigate(`/employee/${myProfileId}`);
    }
  };

  const settingsMenu: SettingsMenuItem[] = [
    {
      id: "profile",
      label: "My Profile",
      icon: <UserCircle className="h-5 w-5" />,
      description: loadingProfile 
        ? "Loading profile..." 
        : myProfileId 
          ? "View and edit your profile information"
          : "Profile not available",
      action: handleProfileClick
    },
    {
      id: "account",
      label: "Account Information",
      icon: <User className="h-5 w-5" />,
      description: "View and manage your account details",
      href: "/settings/account"
    },
    {
      id: "password",
      label: "Change Password",
      icon: <Lock className="h-5 w-5" />,
      description: "Update your account password",
      href: "/settings/password"
    },
    ...((role === "admin" || role === "manager") ? [{
      id: "peer-reviewer-groups",
      label: "Peer Reviewer Groups",
      icon: <Users className="h-5 w-5" />,
      description: "Create and manage reusable groups of task reviewers",
      href: "/peer-reviewer-groups"
    } as SettingsMenuItem] : []),
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="h-5 w-5" />,
      description: "Manage notification preferences",
      href: "/settings/notifications"
    },
    {
      id: "privacy",
      label: "Privacy & Security",
      icon: <Shield className="h-5 w-5" />,
      description: "Control your privacy settings",
      href: "/settings/privacy"
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: <Palette className="h-5 w-5" />,
      description: "Customize the look and feel",
      href: "/settings/appearance"
    },
    {
      id: "language",
      label: "Language & Region",
      icon: <Globe className="h-5 w-5" />,
      description: "Set your language preferences",
      href: "/settings/language"
    },
    {
      id: "logout",
      label: "Sign Out",
      icon: <LogOut className="h-5 w-5" />,
      description: "Sign out from your account",
      action: handleSignOut,
      variant: "danger"
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-2">
          {settingsMenu.map((item) => {
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.href) {
                    navigate(item.href);
                  }
                }}
                disabled={item.id === "profile" && (loadingProfile || !myProfileId)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left group ${
                  item.variant === "danger" ? "hover:bg-destructive/10 hover:border-destructive" : ""
                } ${item.id === "profile" && (loadingProfile || !myProfileId) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    item.variant === "danger" 
                      ? "bg-destructive/10 text-destructive" 
                      : "bg-primary/10 text-primary"
                  }`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className={`font-medium ${
                      item.variant === "danger" ? "text-destructive" : ""
                    }`}>
                      {item.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className={`h-5 w-5 transition-colors ${
                  item.variant === "danger"
                    ? "text-destructive"
                    : "text-muted-foreground group-hover:text-foreground"
                }`} />
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
