import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculateCarryForward,
  calculateNextResetDate,
  validateResetSettings,
} from "@/lib/leave-reset-utils";

describe("Leave Reset Utilities", () => {
  describe("calculateCarryForward", () => {
    it("should calculate carry forward with no limit", () => {
      const balance = {
        user_id: "test-user",
        casual_leaves_used: 2,
        casual_leaves_entitled: 6,
        medical_leaves_used: 1,
        medical_leaves_entitled: 6,
        emergency_leaves_used: 0,
        emergency_leaves_entitled: 6,
        lop_leaves_used: 0,
        lop_leaves_entitled: 6,
        half_day_leaves_used: 0,
        half_day_leaves_entitled: 6,
      };

      // Casual remaining: 4, Medical remaining: 5, Total: 9
      const result = calculateCarryForward(balance, 0);
      expect(result).toBe(9);
    });

    it("should apply max carry forward limit", () => {
      const balance = {
        user_id: "test-user",
        casual_leaves_used: 2,
        casual_leaves_entitled: 6,
        medical_leaves_used: 1,
        medical_leaves_entitled: 6,
        emergency_leaves_used: 0,
        emergency_leaves_entitled: 6,
        lop_leaves_used: 0,
        lop_leaves_entitled: 6,
        half_day_leaves_used: 0,
        half_day_leaves_entitled: 6,
      };

      // Max 5 days, but 9 available
      const result = calculateCarryForward(balance, 5);
      expect(result).toBe(5);
    });

    it("should return 0 if no leaves to carry forward", () => {
      const balance = {
        user_id: "test-user",
        casual_leaves_used: 6,
        casual_leaves_entitled: 6,
        medical_leaves_used: 6,
        medical_leaves_entitled: 6,
        emergency_leaves_used: 0,
        emergency_leaves_entitled: 6,
        lop_leaves_used: 0,
        lop_leaves_entitled: 6,
        half_day_leaves_used: 0,
        half_day_leaves_entitled: 6,
      };

      const result = calculateCarryForward(balance, 10);
      expect(result).toBe(0);
    });
  });

  describe("calculateNextResetDate", () => {
    beforeEach(() => {
      // Mock current date as Jan 15, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 15));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should calculate next monthly reset", () => {
      const settings = {
        reset_frequency: "monthly",
        reset_day: 1,
      };

      const result = calculateNextResetDate(settings);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2025);
    });

    it("should calculate next quarterly reset", () => {
      const settings = {
        reset_frequency: "quarterly",
        reset_day: 1,
      };

      const result = calculateNextResetDate(settings);
      expect(result.getMonth()).toBe(3); // April (next quarter)
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2025);
    });

    it("should calculate next half-yearly reset", () => {
      const settings = {
        reset_frequency: "half_yearly",
        reset_month: 1,
        reset_day: 1,
      };

      const result = calculateNextResetDate(settings);
      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2025);
    });

    it("should calculate next yearly reset", () => {
      const settings = {
        reset_frequency: "yearly",
        reset_month: 1,
        reset_day: 1,
      };

      const result = calculateNextResetDate(settings);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2026); // Next year
    });

    it("should handle past dates in current year for yearly reset", () => {
      // Set date to Dec 15, 2025
      vi.setSystemTime(new Date(2025, 11, 15));

      const settings = {
        reset_frequency: "yearly",
        reset_month: 6, // June
        reset_day: 1,
      };

      const result = calculateNextResetDate(settings);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getFullYear()).toBe(2026); // Next year
    });
  });

  describe("validateResetSettings", () => {
    it("should validate valid settings", () => {
      const settings = {
        reset_frequency: "monthly",
        reset_day: 1,
        carry_forward_enabled: false,
      };

      const result = validateResetSettings(settings);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should reject invalid reset frequency", () => {
      const settings = {
        reset_frequency: "invalid",
        reset_day: 1,
      };

      const result = validateResetSettings(settings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid reset frequency");
    });

    it("should reject invalid reset day", () => {
      const settings = {
        reset_frequency: "monthly",
        reset_day: 32,
      };

      const result = validateResetSettings(settings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Reset day must be between 1 and 31");
    });

    it("should reject invalid reset month", () => {
      const settings = {
        reset_frequency: "yearly",
        reset_month: 13,
        reset_day: 1,
      };

      const result = validateResetSettings(settings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Reset month must be between 1 and 12");
    });

    it("should validate carry forward settings", () => {
      const settings = {
        reset_frequency: "monthly",
        reset_day: 1,
        carry_forward_enabled: true,
        max_carry_forward: -1,
        carry_forward_expiry: 365,
      };

      const result = validateResetSettings(settings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Maximum carry forward must be non-negative");
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete reset scenario", () => {
      // Employee has 4 casual + 5 medical unused = 9 days
      const balance = {
        user_id: "emp-001",
        casual_leaves_used: 2,
        casual_leaves_entitled: 6,
        medical_leaves_used: 1,
        medical_leaves_entitled: 6,
        emergency_leaves_used: 0,
        emergency_leaves_entitled: 6,
        lop_leaves_used: 1,
        lop_leaves_entitled: 6,
        half_day_leaves_used: 0,
        half_day_leaves_entitled: 6,
      };

      const settings = {
        reset_frequency: "monthly",
        reset_day: 1,
        carry_forward_enabled: true,
        max_carry_forward: 5,
      };

      // Validate settings
      const validation = validateResetSettings(settings);
      expect(validation.valid).toBe(true);

      // Calculate carry forward
      const carryForward = calculateCarryForward(balance, settings.max_carry_forward);
      expect(carryForward).toBe(5); // Limited to 5

      // Calculate next reset
      const nextReset = calculateNextResetDate(settings);
      expect(nextReset.getDate()).toBe(1);
    });
  });
});

// Manual Testing Checklist
export const MANUAL_TEST_CHECKLIST = {
  "Database Setup": [
    "✓ leave_reset_settings table created",
    "✓ leave_reset_history table created",
    "✓ RLS policies configured for admin-only access",
    "✓ Indexes created for performance",
  ],
  "Component UI": [
    "Admin can view reset settings",
    "Admin can change reset frequency",
    "Admin can set reset day and time",
    "Admin can toggle carry forward",
    "Admin can set max carry forward days",
    "Admin can set carry forward expiry",
    "Settings save to database",
    "Settings load from database on component mount",
    "Next reset date calculated correctly",
    "Last reset date displayed after reset",
  ],
  "Manual Reset Button": [
    "Button visible and enabled",
    "Confirmation dialog appears",
    "Shows spinner during processing",
    "Shows success toast with employee count",
    "Shows error toast if reset fails",
    "Updates last reset date",
    "Updates next reset date",
  ],
  "Edge Function": [
    "Function authenticates admin user",
    "Rejects non-admin users",
    "Resets all active employee balances",
    "Carries forward unused leaves when enabled",
    "Applies max carry forward limit",
    "Creates leave_balances record if not exists",
    "Updates existing record if exists",
    "Logs to leave_reset_history table",
    "Sends notifications to employees",
    "Updates next_reset_date in settings",
    "Returns correct employee count",
  ],
  "Carry Forward Logic": [
    "Calculates unused casual leaves correctly",
    "Calculates unused medical leaves correctly",
    "Combines casual + medical for carry forward",
    "Respects max carry forward limit",
    "Handles zero limit (unlimited carry forward)",
    "Carries forward amount added to half_day_leaves_used",
  ],
  "Edge Cases": [
    "Handle first time reset (no previous balance)",
    "Handle reset with no active employees",
    "Handle monthly reset on day 31 (month without 31 days)",
    "Handle leap year dates",
    "Handle timezone differences",
    "Handle concurrent reset requests",
    "Handle database errors gracefully",
  ],
};
