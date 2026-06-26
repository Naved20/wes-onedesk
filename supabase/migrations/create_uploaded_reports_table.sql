-- Create uploaded_reports table for storing weekly report submissions
CREATE TABLE IF NOT EXISTS public.uploaded_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  report_date DATE NOT NULL,
  file_url TEXT NOT NULL, -- Google Drive link
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_uploaded_reports_employee_id 
  ON public.uploaded_reports(employee_id);

CREATE INDEX IF NOT EXISTS idx_uploaded_reports_report_date 
  ON public.uploaded_reports(report_date);

-- Enable RLS (Row Level Security)
ALTER TABLE public.uploaded_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees can view their own reports
CREATE POLICY "Employees can view own reports"
  ON public.uploaded_reports
  FOR SELECT
  USING (auth.uid() = employee_id);

-- RLS Policy: Employees can insert their own reports
CREATE POLICY "Employees can insert own reports"
  ON public.uploaded_reports
  FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

-- RLS Policy: Employees can delete their own reports
CREATE POLICY "Employees can delete own reports"
  ON public.uploaded_reports
  FOR DELETE
  USING (auth.uid() = employee_id);

-- RLS Policy: Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.uploaded_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Policy: Admins can delete any report
CREATE POLICY "Admins can delete any report"
  ON public.uploaded_reports
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_uploaded_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uploaded_reports_updated_at_trigger
BEFORE UPDATE ON public.uploaded_reports
FOR EACH ROW
EXECUTE FUNCTION update_uploaded_reports_updated_at();
