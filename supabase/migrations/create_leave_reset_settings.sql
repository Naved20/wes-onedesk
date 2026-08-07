-- Create leave_reset_settings table for storing balance reset configuration
CREATE TABLE IF NOT EXISTS public.leave_reset_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_frequency TEXT NOT NULL CHECK (reset_frequency IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'never')),
  reset_month INTEGER CHECK (reset_month IS NULL OR (reset_month >= 1 AND reset_month <= 12)),
  reset_day INTEGER DEFAULT 1 CHECK (reset_day >= 1 AND reset_day <= 31),
  reset_time TEXT DEFAULT '00:00',
  carry_forward_enabled BOOLEAN DEFAULT false,
  max_carry_forward INTEGER DEFAULT 0,
  carry_forward_expiry INTEGER DEFAULT 365,
  last_reset_date TIMESTAMP WITH TIME ZONE,
  next_reset_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_leave_reset_settings_active ON public.leave_reset_settings(is_active);

-- Enable RLS
ALTER TABLE public.leave_reset_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit reset settings
CREATE POLICY "Only admins can view reset settings" ON public.leave_reset_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update reset settings" ON public.leave_reset_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert reset settings" ON public.leave_reset_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create table to track reset history
CREATE TABLE IF NOT EXISTS public.leave_reset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
  frequency TEXT NOT NULL,
  employees_affected INTEGER DEFAULT 0,
  leaves_carried_forward NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for history
CREATE INDEX idx_leave_reset_history_date ON public.leave_reset_history(reset_date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_reset_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS leave_reset_settings_updated_at ON public.leave_reset_settings;
CREATE TRIGGER leave_reset_settings_updated_at
  BEFORE UPDATE ON public.leave_reset_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_reset_settings_updated_at();
