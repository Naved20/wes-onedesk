-- Migration: 20260906_add_checkout_rules_to_shifts.sql
-- Add configurable check-out rules to shifts table

ALTER TABLE IF EXISTS public.shifts
ADD COLUMN IF NOT EXISTS is_checkout_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS early_checkout_threshold_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS max_checkout_hours_after_end NUMERIC(3,1) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS min_hours_full_day NUMERIC(4,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS missing_checkout_action TEXT DEFAULT 'no_penalty';

COMMENT ON COLUMN public.shifts.is_checkout_mandatory IS 'Whether check-out is strictly required for this shift (ON/OFF)';
COMMENT ON COLUMN public.shifts.early_checkout_threshold_minutes IS 'Minutes before shift end where check-out is allowed without penalty';
COMMENT ON COLUMN public.shifts.max_checkout_hours_after_end IS 'Hours after shift ends where check-out is still accepted as valid';
COMMENT ON COLUMN public.shifts.min_hours_full_day IS 'Minimum hours needed between check-in and check-out to qualify for full-day attendance';
COMMENT ON COLUMN public.shifts.missing_checkout_action IS 'Action to take if checkout is mandatory but missed: no_penalty, mark_half_day, pending_review';
