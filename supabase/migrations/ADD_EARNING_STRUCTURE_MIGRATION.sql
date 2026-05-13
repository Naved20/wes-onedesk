-- Create earning_structure table to store reward rates
CREATE TABLE IF NOT EXISTS public.earning_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tasks_per_month INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  monthly_earning DECIMAL(10, 2) GENERATED ALWAYS AS (rate * tasks_per_month) STORED,
  how_to_earn TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_earning_structure_active ON public.earning_structure(is_active, display_order);

-- Insert default earning structure
INSERT INTO public.earning_structure (task_type, rate, tasks_per_month, frequency, how_to_earn, display_order) VALUES
('English Reading, listening & speaking Task', 5, 50, 'DAILY', 'Read, Write, Speak & Record the given article and earn.', 1),
('Lesson Plan & Delivery', 10, 25, 'DAILY', 'Complete the assigned homework, research and write and earn', 2),
('Soft & Digital Skills', 20, 25, 'DAILY', 'Complete GT Session task and earn', 3),
('Performance Based Reward', 400, 2, 'MONTHLY', 'Connect with your mentor complete the mentorship sessions as per the agenda share record timey and earn', 4)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_earning_structure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS earning_structure_updated_at ON public.earning_structure;
CREATE TRIGGER earning_structure_updated_at
  BEFORE UPDATE ON public.earning_structure
  FOR EACH ROW
  EXECUTE FUNCTION update_earning_structure_updated_at();

-- Add RLS policies
ALTER TABLE public.earning_structure ENABLE ROW LEVEL SECURITY;

-- Everyone can read earning structure
CREATE POLICY "Anyone can view earning structure"
  ON public.earning_structure FOR SELECT
  USING (is_active = true);

-- Only admins can insert/update/delete
CREATE POLICY "Only admins can modify earning structure"
  ON public.earning_structure FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
