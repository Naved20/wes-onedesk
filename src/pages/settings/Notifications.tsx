import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Bell, Megaphone, Calendar, Clock, CheckSquare, DollarSign, FileText, HelpCircle, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type PrefKey = "enabled" | "announcements" | "leaves" | "attendance" | "tasks" | "salary" | "documents" | "support";

interface Prefs {
  enabled: boolean;
  announcements: boolean;
  leaves: boolean;
  attendance: boolean;
  tasks: boolean;
  salary: boolean;
  documents: boolean;
  support: boolean;
}

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  announcements: true,
  leaves: true,
  attendance: true,
  tasks: true,
  salary: true,
  documents: true,
  support: true,
};

const ITEMS: { key: Exclude<PrefKey, "enabled">; label: string; desc: string; icon: any }[] = [
  { key: "announcements", label: "Announcements", desc: "Naye announcements aane par", icon: Megaphone },
  { key: "leaves", label: "Leaves", desc: "Leave apply, approve, ya reject hone par", icon: Calendar },
  { key: "attendance", label: "Attendance", desc: "Attendance approve ya reject hone par", icon: Clock },
  { key: "tasks", label: "Tasks & Reviews", desc: "Task assign ya peer review request par", icon: CheckSquare },
  { key: "salary", label: "Salary & Payslip", desc: "Payslip generate ya salary paid hone par", icon: DollarSign },
  { key: "documents", label: "Documents", desc: "Document verify hone par", icon: FileText },
  { key: "support", label: "Support Requests", desc: "Support request pe reply aane par", icon: HelpCircle },
];

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPerm(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled,
          announcements: data.announcements,
          leaves: data.leaves,
          attendance: data.attendance,
          tasks: data.tasks,
          salary: data.salary,
          documents: data.documents,
          support: data.support,
        });
      } else {
        // create default row
        await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id });
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const update = async (key: PrefKey, value: boolean) => {
    if (!user?.id) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  };

  const requestBrowserPerm = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Not supported", description: "Aapka browser notifications support nahi karta", variant: "destructive" });
      return;
    }
    const p = await Notification.requestPermission();
    setBrowserPerm(p);
    if (p === "granted") {
      toast({ title: "Enabled", description: "Browser notifications enabled" });
      new Notification("Notifications enabled", { body: "Ab aapko browser pop-ups milengi." });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground">Kis cheez ki notification mile, aap control karein</p>
          </div>
        </div>

        {/* Master switch */}
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${prefs.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {prefs.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-medium">All notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Master switch — off karne par koi bhi notification nahi aayegi
                </p>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-6 w-11" />
            ) : (
              <Switch
                checked={prefs.enabled}
                onCheckedChange={(v) => update("enabled", v)}
              />
            )}
          </CardContent>
        </Card>

        {/* Browser push permission */}
        <Card>
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium">Browser push notifications</h3>
              <p className="text-sm text-muted-foreground">
                {browserPerm === "granted"
                  ? "Enabled — aapko desktop / mobile pop-ups milengi jab app open ho."
                  : browserPerm === "denied"
                  ? "Blocked — browser settings me jaake unblock karein."
                  : "Allow karein taaki naye notifications turant pop-up me dikhe."}
              </p>
            </div>
            <Button
              variant={browserPerm === "granted" ? "secondary" : "default"}
              disabled={browserPerm === "granted" || browserPerm === "denied"}
              onClick={requestBrowserPerm}
            >
              {browserPerm === "granted" ? "Enabled" : browserPerm === "denied" ? "Blocked" : "Enable"}
            </Button>
          </CardContent>
        </Card>

        {/* Per-type toggles */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground px-1">Notification types</h2>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const value = prefs[item.key];
            const disabled = !prefs.enabled;
            return (
              <Card key={item.key} className={disabled ? "opacity-50" : ""}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{item.label}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  {loading ? (
                    <Skeleton className="h-6 w-11" />
                  ) : (
                    <Switch
                      checked={value}
                      disabled={disabled}
                      onCheckedChange={(v) => update(item.key, v)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
