-- Create leave_rules_config table for storing rules for each leave type
CREATE TABLE IF NOT EXISTS public.leave_rules_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type TEXT NOT NULL UNIQUE CHECK (leave_type IN ('casual', 'medical', 'emergency', 'lop', 'half_day')),
  max_per_request INTEGER NOT NULL DEFAULT 2 CHECK (max_per_request >= 1),
  max_per_week INTEGER NOT NULL DEFAULT 5 CHECK (max_per_week >= 1),
  max_per_month INTEGER NOT NULL DEFAULT 6 CHECK (max_per_month >= 1),
  min_gap_between_requests INTEGER NOT NULL DEFAULT 0 CHECK (min_gap_between_requests >= 0),
  advance_notice_days INTEGER NOT NULL DEFAULT 0 CHECK (advance_notice_days >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_leave_rules_config_type ON public.leave_rules_config(leave_type);

-- Enable RLS
ALTER TABLE public.leave_rules_config ENABLE ROW LEVEL SECURITY;

-- Everyone can view rules (needed for leave application)
CREATE POLICY "Anyone can view leave rules" ON public.leave_rules_config
  FOR SELECT USING (true);

-- Only admins can update rules
CREATE POLICY "Only admins can update leave rules" ON public.leave_rules_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can insert rules
CREATE POLICY "Only admins can insert leave rules" ON public.leave_rules_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_rules_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS leave_rules_config_updated_at ON public.leave_rules_config;
CREATE TRIGGER leave_rules_config_updated_at
  BEFORE UPDATE ON public.leave_rules_config
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_rules_config_updated_at();

-- Insert default rules
INSERT INTO public.leave_rules_config (leave_type, max_per_request, max_per_week, max_per_month, min_gap_between_requests, advance_notice_days)
VALUES
  ('casual', 2, 5, 6, 0, 0),
  ('medical', 2, 5, 6, 0, 0),
  ('emergency', 1, 2, 3, 7, 0),
  ('lop', 1, 2, 6, 0, 0),
  ('half_day', 1, 3, 8, 0, 0)
ON CONFLICT (leave_type) DO NOTHING;
