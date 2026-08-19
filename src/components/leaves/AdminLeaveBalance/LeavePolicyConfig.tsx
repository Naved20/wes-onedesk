import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Edit2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LeavePolicy {
  leaveType: string;
  monthlyBalance: number;
  salaryImpact: number;
  carryForwardAllowed: boolean;
}

const DEFAULT_POLICIES: LeavePolicy[] = [
  {
    leaveType: "Casual",
    monthlyBalance: 6,
    salaryImpact: 0,
    carryForwardAllowed: false,
  },
  {
    leaveType: "Medical",
    monthlyBalance: 6,
    salaryImpact: 0,
    carryForwardAllowed: false,
  },
  {
    leaveType: "Emergency",
    monthlyBalance: 6,
    salaryImpact: 100,
    carryForwardAllowed: false,
  },
  {
    leaveType: "LOP",
    monthlyBalance: 6,
    salaryImpact: 100,
    carryForwardAllowed: false,
  },
  {
    leaveType: "Half Day",
    monthlyBalance: 6,
    salaryImpact: 50,
    carryForwardAllowed: false,
  },
];

export function LeavePolicyConfig() {
  const [policies, setPolicies] = useState<LeavePolicy[]>(DEFAULT_POLICIES);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPoliciesFromDatabase();
  }, []);

  const fetchPoliciesFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_balance_config")
        .select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        const dbPolicies = data.map((p: any) => ({
          leaveType: p.leave_type.charAt(0).toUpperCase() + p.leave_type.slice(1),
          monthlyBalance: p.monthly_balance,
          salaryImpact: p.salary_impact_percent,
          carryForwardAllowed: p.carry_forward_allowed || false,
        }));
        setPolicies(dbPolicies);
      } else {
        await createDefaultPolicies();
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
      setPolicies(DEFAULT_POLICIES);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPolicies = async () => {
    try {
      const defaultData = DEFAULT_POLICIES.map(p => ({
        leave_type: p.leaveType.toLowerCase(),
        monthly_balance: p.monthlyBalance,
        salary_impact_percent: p.salaryImpact,
        carry_forward_allowed: p.carryForwardAllowed,
      }));

      const { error } = await supabase
        .from("leave_balance_config")
        .insert(defaultData);

      if (error && error.code !== "23505") throw error;
      setPolicies(DEFAULT_POLICIES);
    } catch (error) {
      console.error("Error creating default policies:", error);
    }
  };

  const handleEditPolicy = (policy: LeavePolicy) => {
    setEditingPolicy({ ...policy });
    setDialogOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!editingPolicy) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("leave_balance_config")
        .upsert({
          leave_type: editingPolicy.leaveType.toLowerCase(),
          monthly_balance: editingPolicy.monthlyBalance,
          salary_impact_percent: editingPolicy.salaryImpact,
          carry_forward_allowed: editingPolicy.carryForwardAllowed,
        }, {
          onConflict: "leave_type"
        });

      if (error) throw error;

      setPolicies(policies.map(p => 
        p.leaveType === editingPolicy.leaveType ? editingPolicy : p
      ));
      
      toast({
        title: "Success",
        description: `${editingPolicy.leaveType} policy updated successfully.`,
      });
      
      setDialogOpen(false);
      setEditingPolicy(null);
    } catch (error) {
      console.error("Error saving policy:", error);
      toast({
        title: "Error",
        description: "Failed to save policy",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setPolicies(DEFAULT_POLICIES);
    toast({
      title: "Reset",
      description: "All policies reset to defaults.",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leave Policy Configuration</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure yearly balance and salary impact for each leave type
            </p>
          </div>
          
        </CardHeader>
        <CardContent>
          <div className=" grid grid-cols-2 md:grid-cols-3 gap-4 ">
            {policies.map((policy) => (
              <div
                key={policy.leaveType}
                className="border rounded-lg p-4 space-y-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{policy.leaveType}</h3>
                    <Badge variant="outline">
                      {policy.monthlyBalance} days                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditPolicy(policy)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                </div>

                <div className=" gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Yearly Balance</p>
                    <p className="font-semibold">{policy.monthlyBalance} days</p>
                  </div>

                  
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EditPolicyDialog
        policy={editingPolicy}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSavePolicy}
        saving={saving}
        onPolicyChange={setEditingPolicy}
      />
    </div>
  );
}

interface EditPolicyDialogProps {
  policy: LeavePolicy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onPolicyChange: (policy: LeavePolicy) => void;
}

function EditPolicyDialog({
  policy,
  open,
  onOpenChange,
  onSave,
  saving,
  onPolicyChange,
}: EditPolicyDialogProps) {
  if (!policy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {policy.leaveType} Policy</DialogTitle>
          <DialogDescription>
            Configure yearly balance and salary deduction for {policy.leaveType} leave
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Yearly Balance (days)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={policy.monthlyBalance}
              onChange={(e) =>
                onPolicyChange({
                  ...policy,
                  monthlyBalance: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <Label>Salary Deduction Impact (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="10"
              value={policy.salaryImpact}
              onChange={(e) =>
                onPolicyChange({
                  ...policy,
                  salaryImpact: parseInt(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              0% = No deduction, 100% = Full day deduction
            </p>
          </div>

          
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
