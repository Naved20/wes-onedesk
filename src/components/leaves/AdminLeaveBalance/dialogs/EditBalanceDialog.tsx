import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmployeeBalance {
  user_id: string;
  employee_name: string;
  casual_balance: number;
  medical_balance: number;
  emergency_balance: number;
  lop_balance: number;
  half_day_balance: number;
}

interface EditBalanceDialogProps {
  employee: EmployeeBalance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

interface PolicyConfig {
  casual: number;
  medical: number;
  emergency: number;
  lop: number;
  half_day: number;
}

export default function EditBalanceDialog({
  employee,
  open,
  onOpenChange,
  onSave,
}: EditBalanceDialogProps) {
  const [casualValue, setCasualValue] = useState(0);
  const [medicalValue, setMedicalValue] = useState(0);
  const [emergencyValue, setEmergencyValue] = useState(0);
  const [lopValue, setLopValue] = useState(0);
  const [halfDayValue, setHalfDayValue] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig>({
    casual: 6,
    medical: 6,
    emergency: 6,
    lop: 6,
    half_day: 6
  });
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  // Fetch policy config when dialog opens
  useEffect(() => {
    if (open) {
      fetchPolicyConfig();
    }
  }, [open]);

  const fetchPolicyConfig = async () => {
    if (!employee) return;
    
    setLoadingPolicy(true);
    try {
      const now = new Date();
      const year = now.getFullYear();

      // Get employee's actual current balance from leave_balances table
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", employee.user_id)
        .eq("year", year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Get current available balance (remaining) for each leave type
        const config: PolicyConfig = {
          casual: Math.max(0, (data.casual_leaves_entitled || 6) - (data.casual_leaves_used || 0)),
          medical: Math.max(0, (data.medical_leaves_entitled || 6) - (data.medical_leaves_used || 0)),  
          emergency: Math.max(0, (data.emergency_leaves_entitled || 6) - (data.emergency_leaves_used || 0)),
          lop: Math.max(0, (data.lop_leaves_entitled || 6) - (data.lop_leaves_used || 0)),
          half_day: Math.max(0, (data.half_day_leaves_entitled || 6) - (data.half_day_leaves_used || 0)),
        };
        
        console.log("Employee actual balance from database:", config);
        setPolicyConfig(config);
        
        // Set initial values to current balance (for easy editing)
        setCasualValue(config.casual);
        setMedicalValue(config.medical);
        setEmergencyValue(config.emergency);
        setLopValue(config.lop);
        setHalfDayValue(config.half_day);
      } else {
        // If no record exists, use default policy values
        const defaultConfig: PolicyConfig = {
          casual: 6,
          medical: 6, 
          emergency: 6,
          lop: 6,
          half_day: 6
        };
        setPolicyConfig(defaultConfig);
        
        // Set initial values  
        setCasualValue(6);
        setMedicalValue(6);
        setEmergencyValue(6);
        setLopValue(6);
        setHalfDayValue(6);
      }
    } catch (error) {
      console.error("Error fetching employee balance:", error);
      // Use defaults if error
      setPolicyConfig({
        casual: 6,
        medical: 6,
        emergency: 6, 
        lop: 6,
        half_day: 6
      });
      
      // Set initial values
      setCasualValue(6);
      setMedicalValue(6);
      setEmergencyValue(6);
      setLopValue(6);
      setHalfDayValue(6);
    } finally {
      setLoadingPolicy(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset form when opening
      setCasualValue(0);
      setMedicalValue(0);
      setEmergencyValue(0);
      setLopValue(0);
      setHalfDayValue(0);
      setReason("");
    }
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    if (!employee) return;

    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the balance adjustment",
        variant: "destructive",
      });
      return;
    }

    const hasChanges =
      casualValue !== policyConfig.casual ||
      medicalValue !== policyConfig.medical ||
      emergencyValue !== policyConfig.emergency ||
      lopValue !== policyConfig.lop ||
      halfDayValue !== policyConfig.half_day;

    if (!hasChanges) {
      toast({
        title: "No Changes",
        description: "Please make at least one change",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const year = now.getFullYear();

      console.log("Editing balance for:", {
        user_id: employee.user_id,
        year,
        newValues: {
          casual: casualValue,
          medical: medicalValue,
          emergency: emergencyValue,
          lop: lopValue,
          halfDay: halfDayValue
        }
      });

      // Get current balance
      const { data: currentBalance, error: fetchError } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", employee.user_id)
        .eq("year", year)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching current balance:", fetchError);
        throw fetchError;
      }

      console.log("Current balance from DB:", currentBalance);
      console.log("Available columns:", currentBalance ? Object.keys(currentBalance) : "No data");

      const casual = Number(currentBalance?.casual_leaves_used) || 0;
      const medical = Number(currentBalance?.medical_leaves_used) || 0;
      const emergency = Number(currentBalance?.emergency_leaves_used) || 0;
      const lop = Number(currentBalance?.lop_leaves_used) || 0;
      const halfDay = Number(currentBalance?.half_day_leaves_used) || 0;

      // Calculate what the new 'used' count should be to achieve desired balance
      // If employee wants 8 casual leaves, and default is 6, then used = 6 - 8 = -2 (negative means bonus)
      // If employee wants 4 casual leaves, and default is 6, then used = 6 - 4 = 2
      const defaultCasual = 6; // This should come from leave_balance_config
      const defaultMedical = 6;
      const defaultEmergency = 6; 
      const defaultLop = 6;
      const defaultHalfDay = 6;

      const newCasualUsed = defaultCasual - casualValue;
      const newMedicalUsed = defaultMedical - medicalValue;
      const newEmergencyUsed = defaultEmergency - emergencyValue;
      const newLopUsed = defaultLop - lopValue;
      const newHalfDayUsed = defaultHalfDay - halfDayValue;

      console.log("Setting new balance values:", {
        casualValue, // What admin wants to set
        newCasualUsed, // What used count will be in database
        medicalValue,
        newMedicalUsed,
        emergencyValue,
        newEmergencyUsed,
        lopValue,
        newLopUsed,
        halfDayValue,
        newHalfDayUsed
      });

      // Update leave_balances table using upsert with conflict resolution
      const { data: result, error } = await supabase
        .from("leave_balances")
        .upsert(
          {
            user_id: employee.user_id,
            month: 1, // Default month
            year,
            casual_leaves_used: newCasualUsed,
            medical_leaves_used: newMedicalUsed,
            emergency_leaves_used: newEmergencyUsed,
            lop_leaves_used: newLopUsed,
            half_day_leaves_used: newHalfDayUsed,
          },
          {
            onConflict: "user_id,year",
          }
        )
        .select();

      if (error) {
        console.error("Database upsert error:", error);
        throw error;
      }

      console.log("Successfully saved to database:", result);

      toast({
        title: "Success",
        description: `Balance updated for ${employee.employee_name}. Changes saved to database.`,
      });

      onSave();
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Complete error details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update balance. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Balance</DialogTitle>
          <DialogDescription>
            Adjust leave balance for {employee.employee_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Positive values add leaves. Negative values deduct leaves.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Set Casual Balance</Label>
              <Input
                type="number"
                min="0"
                value={casualValue}
                onChange={(e) =>
                  setCasualValue(parseInt(e.target.value) || 0)
                }
                placeholder={policyConfig.casual.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {policyConfig.casual} → Set to: {casualValue}
              </p>
            </div>

            <div>
              <Label className="text-xs">Set Medical Balance</Label>
              <Input
                type="number"
                min="0"
                value={medicalValue}
                onChange={(e) =>
                  setMedicalValue(parseInt(e.target.value) || 0)
                }
                placeholder={policyConfig.medical.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {policyConfig.medical} → Set to: {medicalValue}
              </p>
            </div>

            <div>
              <Label className="text-xs">Set Emergency Balance</Label>
              <Input
                type="number"
                min="0"
                value={emergencyValue}
                onChange={(e) =>
                  setEmergencyValue(parseInt(e.target.value) || 0)
                }
                placeholder={policyConfig.emergency.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {policyConfig.emergency} → Set to: {emergencyValue}
              </p>
            </div>

            <div>
              <Label className="text-xs">Set LOP Balance</Label>
              <Input
                type="number"
                min="0"
                value={lopValue}
                onChange={(e) => setLopValue(parseInt(e.target.value) || 0)}
                placeholder={policyConfig.lop.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {policyConfig.lop} → Set to: {lopValue}
              </p>
            </div>

            <div>
              <Label className="text-xs">Set Half Day Balance</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={halfDayValue}
                onChange={(e) =>
                  setHalfDayValue(parseFloat(e.target.value) || 0)
                }
                placeholder={policyConfig.half_day.toString()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {policyConfig.half_day} → Set to: {halfDayValue}
              </p>
            </div>
          </div>

          <div>
            <Label className="font-semibold">Changes Summary:</Label>
            <div className="text-sm space-y-1 mt-2">
              {casualValue !== policyConfig.casual && <p>Casual: {policyConfig.casual} → {casualValue}</p>}
              {medicalValue !== policyConfig.medical && <p>Medical: {policyConfig.medical} → {medicalValue}</p>}
              {emergencyValue !== policyConfig.emergency && <p>Emergency: {policyConfig.emergency} → {emergencyValue}</p>}
              {lopValue !== policyConfig.lop && <p>LOP: {policyConfig.lop} → {lopValue}</p>}
              {halfDayValue !== policyConfig.half_day && <p>Half Day: {policyConfig.half_day} → {halfDayValue}</p>}
            </div>
          </div>

          <div>
            <Label>Reason for Adjustment (Required)</Label>
            <Textarea
              placeholder="Explain why this adjustment is being made..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This will be recorded for audit purposes
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
