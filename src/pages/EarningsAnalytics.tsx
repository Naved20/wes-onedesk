import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EarningsAnalytics } from "@/components/tasks/EarningsAnalytics";
import { ArrowLeft, Coins } from "lucide-react";

export function EarningsAnalyticsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect non-admins back to tasks
    if (role && role !== "admin") {
      navigate("/tasks");
    }
  }, [role, navigate]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tasks")}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Coins className="h-8 w-8 text-green-600" />
                <h1 className="text-3xl font-bold tracking-tight">Earnings Analytics</h1>
              </div>
              <p className="text-muted-foreground mt-1">View employee earnings by task type, person, and month</p>
            </div>
          </div>
        </div>

        {/* Analytics Component */}
        <Card>
          <CardContent className="pt-6">
            <EarningsAnalytics />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
