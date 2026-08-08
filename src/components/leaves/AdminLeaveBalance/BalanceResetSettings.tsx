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
import { Loader2, Calendar, Play, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  resetFrequency: "yearly",
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
    
    // Always yearly reset
    let nextDate = new Date(
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
    if (!confirm("Are you sure you want to reset all leave balances for the entire year? This action cannot be undone.")) {
      return;
    }

    setResettingNow(true);
    try {
      // Get session first to avoid race conditions
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("Authentication failed. Please log in again.");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }

      // Call the reset function via API - always with "yearly" frequency
      const response = await fetch(`${supabaseUrl}/functions/v1/reset-leave-balances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trigger_type: "manual",
          frequency: "yearly",
          carryForwardEnabled: settings.carryForwardEnabled,
          maxCarryForward: settings.maxCarryForward,
          carryForwardExpiry: settings.carryForwardExpiry,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset balances");
      }

      toast({
        title: "Success",
        description: `Yearly reset completed! ${result.employees_affected || 0} employees affected for all 12 months.`,
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
          {/* Frequency is always YEARLY - no need to show selector */}
          <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Label className="text-base font-semibold">Reset Frequency</Label>
            <div className="text-sm">
              <Badge className="bg-blue-600">Yearly Reset</Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Leave balances reset once a year for all 12 months
              </p>
            </div>
          </div>

          {/* Reset Schedule Settings - only for yearly */}
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



          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Reset Settings
            </Button>

            <Button
              onClick={handleResetNow}
              disabled={resettingNow || loading}
              variant="secondary"
              className="gap-2"
            >
              {resettingNow && <Loader2 className="h-4 w-4 animate-spin" />}
              <Play className="h-4 w-4" />
              Reset Now
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
