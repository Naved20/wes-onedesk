-- Create appraisals table
CREATE TABLE IF NOT EXISTS public.appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  appraisal_type TEXT NOT NULL CHECK (appraisal_type IN ('weekly', 'monthly', 'annually')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  appraisal_period_start DATE NOT NULL,
  appraisal_period_end DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_appraisals_employee_id ON public.appraisals(employee_id);
CREATE INDEX idx_appraisals_type ON public.appraisals(appraisal_type);
CREATE INDEX idx_appraisals_period ON public.appraisals(appraisal_period_start, appraisal_period_end);

-- Enable RLS
ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Employees can view their own appraisals
CREATE POLICY "Employees can view own appraisals"
  ON public.appraisals
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employee_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all appraisals
CREATE POLICY "Admins can view all appraisals"
  ON public.appraisals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert appraisals
CREATE POLICY "Admins can insert appraisals"
  ON public.appraisals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update appraisals
CREATE POLICY "Admins can update appraisals"
  ON public.appraisals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete appraisals
CREATE POLICY "Admins can delete appraisals"
  ON public.appraisals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Employees can upload their own appraisals
CREATE POLICY "Employees can upload own appraisals"
  ON public.appraisals
  FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employee_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create storage bucket for appraisals
INSERT INTO storage.buckets (id, name, public)
VALUES ('appraisals', 'appraisals', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for appraisals bucket
CREATE POLICY "Employees can upload own appraisals"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'appraisals' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Employees can view own appraisals"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'appraisals' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all appraisals"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'appraisals' AND
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete appraisals"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'appraisals' AND
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appraisals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_appraisals_timestamp
  BEFORE UPDATE ON public.appraisals
  FOR EACH ROW
  EXECUTE FUNCTION update_appraisals_updated_at();
