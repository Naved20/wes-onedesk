import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Language() {
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
              <Globe className="h-8 w-8" />
              Language & Region
            </h1>
            <p className="text-muted-foreground">Set your language and regional preferences</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <p className="text-muted-foreground">Language settings coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
