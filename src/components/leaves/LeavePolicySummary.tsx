import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LeavePolicyRow {
  leave_type: string;
  label: string;
  advance_notice: number;
  max_per_request: number;
  monthly_balance: number;
  salary_impact: string;
  code: string;
  proof: string;
}

const LEAVE_LABELS: Record<string, string> = {
  casual: "Casual / Paid Leave",
  medical: "Medical Leave",
  emergency: "Emergency Leave",
  lop: "Leave Without Pay / LOP",
  half_day: "Half-Day Leave",
};

const PROOF_REQUIREMENTS: Record<string, string> = {
  casual: "At Request",
  medical: "At Request",
  emergency: "After 2 Days",
  lop: "At Request",
  half_day: "At Request",
};

const SALARY_IMPACT_LABELS: Record<string, { label: string; color: string }> = {
  casual: { label: "Paid Time Off", color: "text-green-600" },
  medical: { label: "Paid Time Off", color: "text-green-600" },
  emergency: { label: "1 LOP", color: "text-amber-600" },
  lop: { label: "1 LOP", color: "text-amber-600" },
  half_day: { label: "0.5 LOP", color: "text-amber-600" },
};

export function LeavePolicySummary() {
  const [policies, setPolicies] = useState<LeavePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicies();
    
    // Subscribe to real-time updates
    const channel = supabase.channel("leave_balance_config_changes");
    
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_balance_config" },
        () => {
          console.log("Policy change detected, refreshing...");
          fetchPolicies();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_balance_config")
        .select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        console.log("Database policies fetched:", data);
        
        // Define the correct order: Casual, Medical, Emergency, LOP, Half Day
        const leaveTypeOrder = ["casual", "medical", "emergency", "lop", "half_day"];
        
        // Create a map from the database data
        const dataMap = new Map(data.map((p: any) => [p.leave_type, p]));
        
        // Build policies in the correct order
        const policyRows = leaveTypeOrder
          .map(leaveType => {
            const p = dataMap.get(leaveType);
            if (!p) {
              console.warn(`No data found for leave type: ${leaveType}`);
              return null;
            }
            
            return {
              leave_type: p.leave_type,
              label: LEAVE_LABELS[p.leave_type] || p.leave_type,
              advance_notice: p.advance_notice,
              max_per_request: p.max_per_request,
              monthly_balance: p.monthly_balance,
              salary_impact: SALARY_IMPACT_LABELS[p.leave_type]?.label || "No deduction",
              code: p.code || "PL",
              proof: PROOF_REQUIREMENTS[p.leave_type] || "At Request",
            };
          })
          .filter(Boolean) as LeavePolicyRow[];
        
        console.log("Formatted policies:", policyRows);
        setPolicies(policyRows);
      } else {
        console.warn("No policies found in database");
      }
    } catch (error) {
      console.error("Error fetching leave policies:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (policies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Leave Policy Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No leave policies configured yet. Please contact admin.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const paidLeaveDays = policies
    .filter(p => p.code === "PL")
    .reduce((sum, p) => sum + p.monthly_balance, 0);
  const leaveWithoutPayDays = policies
    .filter(p => p.code === "LE")
    .reduce((sum, p) => sum + p.monthly_balance, 0);
  const halfDayDays = policies
    .filter(p => p.code === "HD")
    .reduce((sum, p) => sum + p.monthly_balance, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          Leave Policy Summary
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Current leave policies and configuration
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Advance Notice</TableHead>
                <TableHead>Max Days</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Salary Impact</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.leave_type}>
                  <TableCell className="font-medium">{policy.label}</TableCell>
                  <TableCell>
                    {policy.advance_notice === 0
                      ? "Same Day"
                      : policy.advance_notice === 1
                      ? "1 Day Before"
                      : `${policy.advance_notice} Days Before`}
                  </TableCell>
                  <TableCell>{policy.max_per_request} Day(s)</TableCell>
                  <TableCell>{policy.monthly_balance}</TableCell>
                  <TableCell className={SALARY_IMPACT_LABELS[policy.leave_type]?.color || ""}>
                    {policy.salary_impact}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{policy.code}</Badge>
                  </TableCell>
                  <TableCell>{policy.proof}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary Footer */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>PL Total Balance:</strong> {paidLeaveDays} (Casual + Medical) | 
            <strong> LE Total Balance:</strong> {leaveWithoutPayDays} (Emergency + LOP) | 
            <strong> HD Total Balance:</strong> {halfDayDays}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
