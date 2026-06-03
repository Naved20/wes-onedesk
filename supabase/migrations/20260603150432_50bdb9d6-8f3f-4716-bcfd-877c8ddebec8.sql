
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS holiday_name TEXT,
  ADD COLUMN IF NOT EXISTS holiday_description TEXT,
  ADD COLUMN IF NOT EXISTS is_national BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS institution_name TEXT;

DELETE FROM public.attendance a
USING public.attendance b
WHERE a.user_id = b.user_id
  AND a.date = b.date
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance(user_id, date);

CREATE OR REPLACE VIEW public.holidays_view AS
SELECT
  MIN(id::text) AS id,
  date,
  MAX(holiday_name) AS name,
  MAX(holiday_description) AS description,
  bool_or(COALESCE(is_national,false)) AS is_national,
  institution_name
FROM public.attendance
WHERE status::text = 'holiday'
GROUP BY date, institution_name;

GRANT SELECT ON public.holidays_view TO authenticated;

CREATE OR REPLACE FUNCTION public.add_holiday(
  p_date date,
  p_name text,
  p_description text DEFAULT NULL,
  p_is_national boolean DEFAULT false,
  p_institution text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can manage holidays';
  END IF;

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
      WHERE a.user_id = ep.user_id AND a.date = p_date
        AND (a.status::text = 'approved'
             OR a.calculated_status IN ('present','half_day','late','paid_leave','leave'))
    )
  ON CONFLICT (user_id, date) DO UPDATE
    SET status = 'holiday'::attendance_status,
        holiday_name = EXCLUDED.holiday_name,
        holiday_description = EXCLUDED.holiday_description,
        is_national = EXCLUDED.is_national,
        institution_name = EXCLUDED.institution_name,
        calculated_status = 'holiday',
        updated_at = now()
    WHERE public.attendance.status::text <> 'approved'
      AND COALESCE(public.attendance.calculated_status,'') NOT IN ('present','half_day','late','paid_leave','leave');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_holiday(
  p_old_date date, p_old_institution text,
  p_new_date date, p_new_name text, p_new_description text,
  p_new_is_national boolean, p_new_institution text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can manage holidays';
  END IF;
  DELETE FROM public.attendance
  WHERE date = p_old_date AND status::text = 'holiday'
    AND institution_name IS NOT DISTINCT FROM p_old_institution;
  PERFORM public.add_holiday(p_new_date, p_new_name, p_new_description, p_new_is_national, p_new_institution);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_holiday(
  p_date date, p_institution text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can manage holidays';
  END IF;
  DELETE FROM public.attendance
  WHERE date = p_date AND status::text = 'holiday'
    AND institution_name IS NOT DISTINCT FROM p_institution;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_holiday(date,text,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_holiday(date,text,date,text,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_holiday(date,text) TO authenticated;

DO $$
DECLARE h RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='holidays') THEN
    FOR h IN SELECT * FROM public.holidays LOOP
      INSERT INTO public.attendance (
        user_id, date, status, holiday_name, holiday_description,
        is_national, institution_name, calculated_status
      )
      SELECT
        ep.user_id, h.date, 'holiday'::attendance_status, h.name, h.description,
        COALESCE(h.is_national, false), h.institution_name, 'holiday'
      FROM public.employee_profiles ep
      WHERE ep.is_active = true
        AND (h.institution_name IS NULL OR ep.institution_assignment = h.institution_name)
      ON CONFLICT (user_id, date) DO NOTHING;
    END LOOP;
  END IF;
END$$;

DROP TABLE IF EXISTS public.holidays CASCADE;

CREATE OR REPLACE FUNCTION public.sync_holidays_for_new_employee()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendance (
    user_id, date, status, holiday_name, holiday_description,
    is_national, institution_name, calculated_status
  )
  SELECT DISTINCT ON (a.date)
    NEW.user_id, a.date, 'holiday'::attendance_status, a.holiday_name, a.holiday_description,
    a.is_national, a.institution_name, 'holiday'
  FROM public.attendance a
  WHERE a.status::text = 'holiday'
    AND (a.institution_name IS NULL OR a.institution_name = NEW.institution_assignment)
  ON CONFLICT (user_id, date) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_holidays_new_emp ON public.employee_profiles;
CREATE TRIGGER trg_sync_holidays_new_emp
AFTER INSERT ON public.employee_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_holidays_for_new_employee();
