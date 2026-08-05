import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SalaryRules {
  leaveDeductionPercent: number;
  paidLeaveDeductionPercent: number;
  halfDayDeductionPercent: number;
  calculateSalaryOnHolidays: boolean;
  calculateSalaryOnWeekends: boolean;
  roundingMethod: "round_up" | "round_down" | "round_nearest";
}

const DEFAULT_SALARY_RULES: SalaryRules = {
  leaveDeductionPercent: 100,
  paidLeaveDeductionPercent: 0,
  halfDayDeductionPercent: 50,
  calculateSalaryOnHolidays: false,
  calculateSalaryOnWeekends: false,
  roundingMethod: "round_nearest",
};

export function SalaryRulesConfig() {
  const [rules, setRules] = useState<SalaryRules>(DEFAULT_SALARY_RULES);
  const [saving, setSaving] = useState(false);

  const handleSaveRules = async () => {
    // Validation
    if (rules.leaveDeductionPercent < 0 || rules.leaveDeductionPercent > 100) {
      toast({
        title: "Invalid Value",
        description: "Deduction percentage must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    if (rules.paidLeaveDeductionPercent < 0 || rules.paidLeaveDeductionPercent > 100) {
      toast({
        title: "Invalid Value",
        description: "Paid leave deduction must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    if (rules.halfDayDeductionPercent < 0 || rules.halfDayDeductionPercent > 100) {
      toast({
        title: "Invalid Value",
        description: "Half-day deduction must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // In a real app, save to database
      toast({
        title: "Success",
        description: "Salary rules updated successfully.",
      });
    } catch (error) {
      console.error("Error saving rules:", error);
      toast({
        title: "Error",
        description: "Failed to save rules",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetRules = () => {
    setRules(DEFAULT_SALARY_RULES);
    toast({
      title: "Reset",
      description: "Rules reset to defaults.",
    });
  };

  const toggleRule = (key: keyof SalaryRules) => {
    setRules({
      ...rules,
      [key]: !(rules[key] as boolean),
    });
  };

  const updateNumericRule = (key: keyof SalaryRules, value: number) => {
    setRules({
      ...rules,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Salary Deduction Rules</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure salary deduction percentages for different leave types
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleResetRules}
          >
            Reset to Defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Leave Type Deductions */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Leave Type Salary Deductions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Leave (LOP) Deduction */}
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div>
                  <Label className="font-semibold">Leave Without Pay (LOP)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emergency, LOP leaves
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={rules.leaveDeductionPercent}
                    onChange={(e) =>
                      updateNumericRule(
                        "leaveDeductionPercent",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="flex-1"
                  />
                  <span className="font-semibold">%</span>
                </div>
                <div className="text-sm">
                  {rules.leaveDeductionPercent === 0 && (
                    <p className="text-green-600">✓ No salary deduction</p>
                  )}
                  {rules.leaveDeductionPercent === 50 && (
                    <p className="text-amber-600">⚠ Half day deduction</p>
                  )}
                  {rules.leaveDeductionPercent === 100 && (
                    <p className="text-red-600">✗ Full day deduction</p>
                  )}
                  {rules.leaveDeductionPercent > 0 && rules.leaveDeductionPercent < 50 && (
                    <p className="text-amber-600">⚠ Partial deduction</p>
                  )}
                  {rules.leaveDeductionPercent > 50 && rules.leaveDeductionPercent < 100 && (
                    <p className="text-amber-600">⚠ Most salary deducted</p>
                  )}
                </div>
              </div>

              {/* Paid Leave Deduction */}
              <div className="space-y-3 p-3 border rounded-lg bg-green-50 border-green-200">
                <div>
                  <Label className="font-semibold">Paid Leave</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Casual, Medical leaves
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={rules.paidLeaveDeductionPercent}
                    onChange={(e) =>
                      updateNumericRule(
                        "paidLeaveDeductionPercent",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="flex-1"
                  />
                  <span className="font-semibold">%</span>
                </div>
                <div className="text-sm">
                  {rules.paidLeaveDeductionPercent === 0 && (
                    <p className="text-green-600">✓ Fully paid</p>
                  )}
                  {rules.paidLeaveDeductionPercent > 0 && (
                    <p className="text-amber-600">⚠ Partial paid</p>
                  )}
                </div>
              </div>

              {/* Half-Day Deduction */}
              <div className="space-y-3 p-3 border rounded-lg bg-blue-50 border-blue-200">
                <div>
                  <Label className="font-semibold">Half-Day Leave</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Half-day leaves
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={rules.halfDayDeductionPercent}
                    onChange={(e) =>
                      updateNumericRule(
                        "halfDayDeductionPercent",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="flex-1"
                  />
                  <span className="font-semibold">%</span>
                </div>
                <div className="text-sm">
                  {rules.halfDayDeductionPercent === 0 && (
                    <p className="text-green-600">✓ Fully paid</p>
                  )}
                  {rules.halfDayDeductionPercent === 50 && (
                    <p className="text-blue-600">ℹ Standard half-day</p>
                  )}
                  {rules.halfDayDeductionPercent === 100 && (
                    <p className="text-red-600">✗ Full deduction</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Calculation Settings */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Salary Calculation Settings</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="calculateOnHolidays"
                  checked={rules.calculateSalaryOnHolidays}
                  onChange={() => toggleRule("calculateSalaryOnHolidays")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="calculateOnHolidays" className="cursor-pointer font-medium">
                    Calculate Salary on Public Holidays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If leave spans a public holiday, should salary be calculated?
                  </p>
                </div>
                <Badge variant={rules.calculateSalaryOnHolidays ? "default" : "secondary"}>
                  {rules.calculateSalaryOnHolidays ? "Yes" : "No"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded">
                <input
                  type="checkbox"
                  id="calculateOnWeekends"
                  checked={rules.calculateSalaryOnWeekends}
                  onChange={() => toggleRule("calculateSalaryOnWeekends")}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <Label htmlFor="calculateOnWeekends" className="cursor-pointer font-medium">
                    Calculate Salary on Weekends
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If leave spans a weekend, should salary be calculated?
                  </p>
                </div>
                <Badge variant={rules.calculateSalaryOnWeekends ? "default" : "secondary"}>
                  {rules.calculateSalaryOnWeekends ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Rounding Method */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Rounding Method</h3>
            <p className="text-sm text-muted-foreground">
              How to handle decimal salary amounts
            </p>

            <div className="space-y-2">
              {[
                {
                  value: "round_up",
                  label: "Round Up",
                  example: "2.1 → 3, 2.9 → 3",
                },
                {
                  value: "round_down",
                  label: "Round Down",
                  example: "2.1 → 2, 2.9 → 2",
                },
                {
                  value: "round_nearest",
                  label: "Round to Nearest",
                  example: "2.1 → 2, 2.5 → 3, 2.9 → 3",
                },
              ].map((method) => (
                <div
                  key={method.value}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setRules({
                      ...rules,
                      roundingMethod: method.value as any,
                    });
                  }}
                >
                  <input
                    type="radio"
                    id={method.value}
                    name="roundingMethod"
                    checked={rules.roundingMethod === method.value}
                    onChange={() => {}}
                    className="rounded-full"
                  />
                  <div className="flex-1">
                    <Label htmlFor={method.value} className="cursor-pointer font-medium">
                      {method.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{method.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>Summary:</strong> Leave (LOP) days deduct {rules.leaveDeductionPercent}% salary,
              Paid Leave deducts {rules.paidLeaveDeductionPercent}%, Half-day deducts{" "}
              {rules.halfDayDeductionPercent}%.
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <Button
            onClick={handleSaveRules}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Salary Rules
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
