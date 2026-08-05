import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, TrendingUp, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Import section components (will create next)
import { LeavePolicyConfig } from "./AdminLeaveBalance/LeavePolicyConfig";
import { BalanceResetSettings } from "./AdminLeaveBalance/BalanceResetSettings";
import { EmployeeLeaveBalanceManagement } from "./AdminLeaveBalance/EmployeeLeaveBalanceManagement";
import { LeaveRulesConfig } from "./AdminLeaveBalance/LeaveRulesConfig";
import { AdminApprovalRules } from "./AdminLeaveBalance/AdminApprovalRules";
import { SalaryRulesConfig } from "./AdminLeaveBalance/SalaryRulesConfig";
import { LeaveAnalytics } from "./AdminLeaveBalance/LeaveAnalytics";

export function AdminLeaveBalance() {
  const [activeTab, setActiveTab] = useState("policy");
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Leave Balance Management</h2>
        <p className="text-muted-foreground mt-2">
          Configure leave policies, reset schedules, and manage employee leave balances
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="policy" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Policy</span>
          </TabsTrigger>
          <TabsTrigger value="reset" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </TabsTrigger>
          <TabsTrigger value="employee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Employee</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Rules</span>
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Approval</span>
          </TabsTrigger>
          <TabsTrigger value="salary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Salary</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="space-y-4">
          <LeavePolicyConfig />
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
          <BalanceResetSettings />
        </TabsContent>

        <TabsContent value="employee" className="space-y-4">
          <EmployeeLeaveBalanceManagement />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <LeaveRulesConfig />
        </TabsContent>

        <TabsContent value="approval" className="space-y-4">
          <AdminApprovalRules />
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <SalaryRulesConfig />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <LeaveAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
