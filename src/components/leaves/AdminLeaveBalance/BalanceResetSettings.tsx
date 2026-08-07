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
import { Loader2, AlertCircle, Calendar, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, addMonths, addQuarters, addHours } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ResetSettings {
  id?: string;
  resetFrequency: "monthly" | "quarterly" | "half_yearly" | "yearly" | "never";
  resetMonth?: number;
  resetDay?: number;
  resetTime?: string;
  carryForwardEnabled: boolean;
  maxCarryForward: number;
  carryForwardExpiry: number;
}

interface DBResetSettings {
  id: string;
  reset_frequency: string;
  reset_month: number | null;
  reset_day: number;
  reset_time: string;
  carry_forward_enabled: boolean;
  max_carry_forward: number;
  carry_forward_expiry: number;
  last_reset_date: string | null;
  next_reset_date: string | null;
  is_active: boolean;
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
  const [lastResetDate, setLastResetDate] = useState<Date | null>(null);
  const [resettingNow, setResettingNow] = useState(false);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    calculateNextResetDate();
  }, [settings]);

  const loadSavedSettings = async () => {
    setLoading(true);
    try {
      // Load from Supabase database
      const { data, error } = await supabase
        .from("leave_reset_settings")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found, which is okay for first time
        throw error;
      }

      if (data) {
        const dbSettings = data as DBResetSettings;
        setSettings({
          id: dbSettings.id,
          resetFrequency: dbSettings.reset_frequency as any,
          resetMonth: dbSettings.reset_month,
          resetDay: dbSettings.reset_day,
          resetTime: dbSettings.reset_time,
          carryForwardEnabled: dbSettings.carry_forward_enabled,
          maxCarryForward: dbSettings.max_carry_forward,
          carryForwardExpiry: dbSettings.carry_forward_expiry,
        });

        if (dbSettings.last_reset_date) {
          setLastResetDate(new Date(dbSettings.last_reset_date));
        }
      } else {
        // First time - create default settings
        const { data: newSettings, error: insertError } = await supabase
          .from("leave_reset_settings")
          .insert({
            reset_frequency: DEFAULT_RESET_SETTINGS.resetFrequency,
            reset_month: DEFAULT_RESET_SETTINGS.resetMonth,
            reset_day: DEFAULT_RESET_SETTINGS.resetDay,
            reset_time: DEFAULT_RESET_SETTINGS.resetTime,
            carry_forward_enabled: DEFAULT_RESET_SETTINGS.carryForwardEnabled,
            max_carry_forward: DEFAULT_RESET_SETTINGS.maxCarryForward,
            carry_forward_expiry: DEFAULT_RESET_SETTINGS.carryForwardExpiry,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (newSettings) {
          setSettings({
            id: newSettings.id,
            ...DEFAULT_RESET_SETTINGS,
          });
        }
      }
    } catch (error) {
      console.error("Error loading reset settings:", error);
      toast({
        title: "Error",
        description: "Failed to load reset settings",
        variant: "destructive",
      });
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
      const updateData = {
        reset_frequency: settings.resetFrequency,
        reset_month: settings.resetMonth || 1,
        reset_day: settings.resetDay || 1,
        reset_time: settings.resetTime || "00:00",
        carry_forward_enabled: settings.carryForwardEnabled,
        max_carry_forward: settings.maxCarryForward,
        carry_forward_expiry: settings.carryForwardExpiry,
      };

      if (settings.id) {
        // Update existing settings
        const { error } = await supabase
          .from("leave_reset_settings")
          .update(updateData)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { data, error } = await supabase
          .from("leave_reset_settings")
          .insert({
            ...updateData,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setSettings({ ...settings, id: data.id });
        }
      }

      toast({
        title: "Success",
        description: "Reset settings saved successfully.",
      });

      calculateNextResetDate();
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

  const handleResetNow = async () => {
    if (!confirm("Are you sure you want to reset all leave balances now? This action cannot be undone.")) {
      return;
    }

    setResettingNow(true);
    try {
      // Call the reset function via API
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-leave-balances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          trigger_type: "manual",
          frequency: settings.resetFrequency,
          carryForwardEnabled: settings.carryForwardEnabled,
          maxCarryForward: settings.maxCarryForward,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset balances");
      }

      toast({
        title: "Success",
        description: `Reset completed! ${result.employees_affected} employees affected.`,
      });

      // Update last reset date
      setLastResetDate(new Date());

      // Reload settings to get updated last_reset_date
      await loadSavedSettings();
    } catch (error) {
      console.error("Error resetting balances:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset balances",
        variant: "destructive",
      });
    } finally {
      setResettingNow(false);
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

          {lastResetDate && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Last reset: <strong>{format(lastResetDate, "MMMM dd, yyyy HH:mm")}</strong>
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

          {/* Action Buttons */}
          <div >
            <Button
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Reset Settings
            </Button>


          </div>
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
