import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccountInfo() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-8 w-8" />
              Account Information
            </h1>
            <p className="text-muted-foreground">Your current account details</p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-base font-semibold">Email Address</Label>
            <p className="text-lg">{user?.email}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">User ID</Label>
            <p className="text-sm font-mono text-muted-foreground break-all">{user?.id}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Account Created</Label>
            <p className="text-sm text-muted-foreground">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
