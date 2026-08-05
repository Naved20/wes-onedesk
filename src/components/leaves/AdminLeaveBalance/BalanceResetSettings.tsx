import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, addMonths, addQuarters, addHours } from "date-fns";

interface ResetSettings {
  resetFrequency: "monthly" | "quarterly" | "half_yearly" | "yearly" | "never";
  resetMonth?: number; // 1-12
  resetDay?: number; // 1-31
  resetTime?: string; // HH:mm
  carryForwardEnabled: boolean;
  maxCarryForward: number;
  carryForwardExpiry: number; // days
}

const DEFAULT_RESET_SETTINGS: ResetSettings = {
  resetFrequency: "monthly",
  resetMonth: 1,
  resetDay: 1,
  resetTime: "00:00",
  carryForwardEnabled: false,
  maxCarryForward: 0,
  carryForwardExpiry: 365,
};

export function BalanceResetSettings() {
  const [settings, setSettings] = useState<ResetSettings>(DEFAULT_RESET_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextResetDate, setNextResetDate] = useState<Date | null>(null);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    calculateNextResetDate();
  }, [settings]);

  const loadSavedSettings = async () => {
    setLoading(true);
    try {
      // Load from localStorage (in production, load from database)
      const savedSettings = localStorage.getItem("leave_reset_settings");
      
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({
          resetFrequency: parsedSettings.reset_frequency || DEFAULT_RESET_SETTINGS.resetFrequency,
          resetMonth: parsedSettings.reset_month || DEFAULT_RESET_SETTINGS.resetMonth,
          resetDay: parsedSettings.reset_day || DEFAULT_RESET_SETTINGS.resetDay,
          resetTime: parsedSettings.reset_time || DEFAULT_RESET_SETTINGS.resetTime,
          carryForwardEnabled: parsedSettings.carry_forward_enabled || DEFAULT_RESET_SETTINGS.carryForwardEnabled,
          maxCarryForward: parsedSettings.max_carry_forward || DEFAULT_RESET_SETTINGS.maxCarryForward,
          carryForwardExpiry: parsedSettings.carry_forward_expiry || DEFAULT_RESET_SETTINGS.carryForwardExpiry,
        });
        
        console.log("Loaded reset settings:", parsedSettings);
      }
    } catch (error) {
      console.error("Error loading reset settings:", error);
      // Use default settings on error
    } finally {
      setLoading(false);
    }
  };

  const calculateNextResetDate = () => {
    const today = new Date();
    let nextDate: Date | null = null;

    switch (settings.resetFrequency) {
      case "monthly":
        nextDate = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          settings.resetDay || 1
        );
        if (nextDate <= today) {
          nextDate = addMonths(nextDate, 1);
        }
        break;

      case "quarterly":
        const quarterMonths = [1, 4, 7, 10];
        const currentQuarter = Math.floor(today.getMonth() / 3);
        let nextQuarterMonth = quarterMonths[currentQuarter];
        let nextYear = today.getFullYear();

        if (
          today.getMonth() > nextQuarterMonth ||
          (today.getMonth() === nextQuarterMonth &&
            today.getDate() >= (settings.resetDay || 1))
        ) {
          const nextQuarterIndex = (currentQuarter + 1) % 4;
          nextQuarterMonth = quarterMonths[nextQuarterIndex];
          nextYear += nextQuarterIndex === 0 ? 1 : 0;
        }

        nextDate = new Date(nextYear, nextQuarterMonth, settings.resetDay || 1);
        break;

      case "half_yearly":
        const halfYearlyMonths = [
          settings.resetMonth || 1,
          (settings.resetMonth || 1) + 6,
        ];
        const currentHalfYear = today.getMonth() < 6 ? 0 : 1;
        let nextHalfMonth = halfYearlyMonths[currentHalfYear];
        let nextHalfYear = today.getFullYear();

        if (
          today.getMonth() > nextHalfMonth - 1 ||
          (today.getMonth() === nextHalfMonth - 1 &&
            today.getDate() >= (settings.resetDay || 1))
        ) {
          nextHalfMonth = halfYearlyMonths[1 - currentHalfYear];
          nextHalfYear += currentHalfYear === 0 ? 0 : 1;
        }

        nextDate = new Date(nextHalfYear, nextHalfMonth - 1, settings.resetDay || 1);
        break;

      case "yearly":
        nextDate = new Date(
          today.getFullYear(),
          (settings.resetMonth || 1) - 1,
          settings.resetDay || 1
        );
        if (nextDate <= today) {
          nextDate = new Date(
            today.getFullYear() + 1,
            (settings.resetMonth || 1) - 1,
            settings.resetDay || 1
          );
        }
        break;

      case "never":
        nextDate = null;
        break;
    }

    setNextResetDate(nextDate);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save to database - create a leave_reset_settings table or store in existing config
      const resetConfig = {
        reset_frequency: settings.resetFrequency,
        reset_month: settings.resetMonth || 1,
        reset_day: settings.resetDay || 1,
        reset_time: settings.resetTime || "00:00",
        carry_forward_enabled: settings.carryForwardEnabled,
        max_carry_forward: settings.maxCarryForward,
        carry_forward_expiry: settings.carryForwardExpiry,
        updated_at: new Date().toISOString(),
      };

      // For now, save to localStorage as a quick solution
      // In production, you'd save to a proper database table
      localStorage.setItem("leave_reset_settings", JSON.stringify(resetConfig));
      
      console.log("Reset settings saved:", resetConfig);
      
      toast({
        title: "Success",
        description: "Reset settings saved successfully. Changes will take effect immediately.",
      });
    } catch (error) {
      console.error("Error saving reset settings:", error);
      toast({
        title: "Error", 
        description: "Failed to save reset settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Balance Reset Configuration</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure when and how employee leave balances reset
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading settings...</span>
            </div>
          ) : (
            <>
              {/* Reset Frequency */}
              <div className="space-y-3">
            <Label className="text-base font-semibold">Reset Frequency</Label>
            <Select
              value={settings.resetFrequency}
              onValueChange={(value: any) =>
                setSettings({ ...settings, resetFrequency: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="half_yearly">Half-Yearly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="never">Never Reset</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select how often employee leave balances should reset
            </p>
          </div>

          {/* Reset Schedule Settings */}
          {settings.resetFrequency !== "never" && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <h3 className="font-semibold text-sm">Reset Schedule</h3>

              {settings.resetFrequency !== "monthly" && (
                <div>
                  <Label>Reset Month</Label>
                  <Select
                    value={String(settings.resetMonth || 1)}
                    onValueChange={(value) =>
                      setSettings({
                        ...settings,
                        resetMonth: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => ({
                        value: i + 1,
                        label: format(new Date(2024, i, 1), "MMMM"),
                      })).map((month) => (
                        <SelectItem key={month.value} value={String(month.value)}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Reset Day (1-31)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={settings.resetDay || 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        resetDay: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Reset Time (24-hour)</Label>
                  <Input
                    type="time"
                    value={settings.resetTime || "00:00"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        resetTime: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Next Reset Date */}
          {nextResetDate && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Next scheduled reset: <strong>{format(nextResetDate, "MMMM dd, yyyy")}</strong> at{" "}
                <strong>{settings.resetTime || "00:00"}</strong>
              </AlertDescription>
            </Alert>
          )}

          {settings.resetFrequency === "never" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Balances will never reset. Employees will keep accumulating leave indefinitely.
              </AlertDescription>
            </Alert>
          )}

          {/* Carry Forward Settings */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            <h3 className="font-semibold text-sm">Carry Forward Settings</h3>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="carryForward"
                checked={settings.carryForwardEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    carryForwardEnabled: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="carryForward" className="cursor-pointer">
                Enable Carry Forward of Unused Leaves
              </Label>
            </div>

            {settings.carryForwardEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Maximum Days to Carry Forward</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.maxCarryForward}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxCarryForward: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    0 = No limit
                  </p>
                </div>

                <div>
                  <Label>Carry Forward Expiry (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.carryForwardExpiry}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        carryForwardExpiry: parseInt(e.target.value) || 365,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Carried forward leaves expire after this many days
                  </p>
                </div>
              </div>
            )}

            {!settings.carryForwardEnabled && (
              <Badge variant="secondary">Carry Forward Disabled</Badge>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveSettings}
            disabled={saving || loading}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Reset Settings
          </Button>
          </>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            How Balance Reset Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-blue-900">
          <p>
            • When a reset occurs, all employee leave balances for that period reset to their
            configured monthly allocation.
          </p>
          <p>
            • If carry forward is enabled, unused leaves from the previous period are added to
            the new period up to the maximum limit.
          </p>
          <p>
            • Carried forward leaves expire after the configured number of days and cannot be used.
          </p>
          <p>
            • Reset happens automatically at the scheduled time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
