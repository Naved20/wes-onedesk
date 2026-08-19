-- Allow Admin manual overrides on holidays by dropping the restriction trigger
-- Resolution for P0001 error: 'Cannot mark attendance as absent on a holiday'

DROP TRIGGER IF EXISTS trigger_prevent_absent_on_holidays ON public.attendance;

CREATE OR REPLACE FUNCTION public.prevent_absent_on_holidays()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Do not raise exception; allow manual overrides
  RETURN NEW;
END;
$$;
