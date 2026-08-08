-- Add advance_notice_days column to leave_rules_config table
ALTER TABLE public.leave_rules_config
ADD COLUMN IF NOT EXISTS advance_notice_days INTEGER NOT NULL DEFAULT 0 CHECK (advance_notice_days >= 0);

-- Update existing records to have default value of 0
UPDATE public.leave_rules_config SET advance_notice_days = 0 WHERE advance_notice_days IS NULL;
