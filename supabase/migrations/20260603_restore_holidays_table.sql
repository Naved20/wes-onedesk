-- Restore holidays table - we'll keep both for now
-- This ensures data consistency while we migrate frontend

-- Recreate holidays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL,
  description text,
  is_national boolean DEFAULT false,
  institution_name text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(date, COALESCE(institution_name, ''))
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can view holidays
DROP POLICY IF EXISTS "View holidays" ON public.holidays;
CREATE POLICY "View holidays"
  ON public.holidays
  FOR SELECT
  USING (true);

-- RLS Policy: Only admins can manage holidays
DROP POLICY IF EXISTS "Manage holidays" ON public.holidays;
CREATE POLICY "Manage holidays"
  ON public.holidays
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_institution ON public.holidays(institution_name);

-- Sync function: Keep attendance and holidays table in sync
CREATE OR REPLACE FUNCTION public.sync_holiday_to_attendance(
  p_date date,
  p_name text,
  p_description text,
  p_is_national boolean,
  p_institution text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert/update attendance rows for all matching employees
  INSERT INTO public.attendance (
    user_id, date, status, holiday_name, holiday_description,
    is_national, institution_name, calculated_status
  )
  SELECT
    ep.user_id, p_date, 'holiday'::attendance_status, p_name, p_description,
    p_is_national, p_institution, 'holiday'
  FROM public.employee_profiles ep
  WHERE ep.is_active = true
    AND (p_institution IS NULL OR ep.institution_assignment = p_institution)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.user_id = ep.user_id
        AND a.date = p_date
        AND (a.status::text IN ('approved', 'present', 'half_day', 'late', 'paid_leave', 'leave')
             OR a.calculated_status IN ('present', 'half_day', 'late', 'paid_leave', 'leave'))
    )
  ON CONFLICT (user_id, date) DO UPDATE
  SET status = 'holiday'::attendance_status,
      holiday_name = EXCLUDED.holiday_name,
      holiday_description = EXCLUDED.holiday_description,
      is_national = EXCLUDED.is_national,
      institution_name = EXCLUDED.institution_name,
      calculated_status = 'holiday',
      updated_at = now()
  WHERE public.attendance.status::text = 'holiday'
    AND COALESCE(public.attendance.calculated_status, '') NOT IN ('present', 'half_day', 'late', 'paid_leave', 'leave');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_holiday_to_attendance(date, text, text, boolean, text) TO authenticated;

-- Trigger: When holiday is inserted/updated, sync to attendance
CREATE OR REPLACE FUNCTION public.trigger_sync_holiday()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.sync_holiday_to_attendance(
      NEW.date, NEW.name, NEW.description,
      COALESCE(NEW.is_national, false),
      NEW.institution_name
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Delete from attendance when holiday is deleted
    DELETE FROM public.attendance
    WHERE date = OLD.date
      AND status::text = 'holiday'
      AND institution_name IS NOT DISTINCT FROM OLD.institution_name;
  END IF;
  
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  ELSE
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_holiday ON public.holidays;
CREATE TRIGGER trg_sync_holiday
AFTER INSERT OR UPDATE OR DELETE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_holiday();

-- Backfill: Sync any existing holidays to attendance (if not already there)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='holidays') THEN
    INSERT INTO public.attendance (
      user_id, date, status, holiday_name, holiday_description,
      is_national, institution_name, calculated_status
    )
    SELECT
      ep.user_id, h.date, 'holiday'::attendance_status, h.name, h.description,
      COALESCE(h.is_national, false), h.institution_name, 'holiday'
    FROM public.holidays h
    CROSS JOIN public.employee_profiles ep
    WHERE ep.is_active = true
      AND (h.institution_name IS NULL OR ep.institution_assignment = h.institution_name)
    ON CONFLICT (user_id, date) DO NOTHING;
  END IF;
END;
$$;
