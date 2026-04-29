import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Appearance() {
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
              <Palette className="h-8 w-8" />
              Appearance
            </h1>
            <p className="text-muted-foreground">Customize the look and feel of your dashboard</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <p className="text-muted-foreground">Appearance settings coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
