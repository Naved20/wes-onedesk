-- Update calculate_working_days function to handle institution-specific holidays
-- A day is considered a holiday if:
-- 1. It's a holiday for all institutions (institution_name IS NULL), OR
-- 2. It's a holiday for any specific institution

CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE := p_start_date;
BEGIN
  WHILE v_current <= p_end_date LOOP
    -- Skip Sundays (0 = Sunday in PostgreSQL)
    IF EXTRACT(DOW FROM v_current) != 0 THEN
      -- Check if not a holiday (either for all institutions or any specific institution)
      IF NOT EXISTS (
        SELECT 1 FROM holidays 
        WHERE date = v_current
      ) THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    v_current := v_current + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.calculate_working_days(DATE, DATE) IS 
'Calculates working days between two dates, excluding Sundays and holidays. Holidays can be institution-specific or applicable to all institutions.';

-- Create institution-aware working days calculation function
CREATE OR REPLACE FUNCTION public.calculate_working_days_for_institution(
  p_start_date DATE,
  p_end_date DATE,
  p_institution_name TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE := p_start_date;
BEGIN
  WHILE v_current <= p_end_date LOOP
    -- Skip Sundays (0 = Sunday in PostgreSQL)
    IF EXTRACT(DOW FROM v_current) != 0 THEN
      -- Check if not a holiday
      -- A day is a holiday if:
      -- 1. It's marked for all institutions (institution_name IS NULL), OR
      -- 2. It's marked for the specific institution
      IF NOT EXISTS (
        SELECT 1 FROM holidays 
        WHERE date = v_current
        AND (
          institution_name IS NULL  -- Holiday for all institutions
          OR institution_name = p_institution_name  -- Holiday for specific institution
        )
      ) THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    v_current := v_current + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.calculate_working_days_for_institution(DATE, DATE, TEXT) IS 
'Calculates working days between two dates for a specific institution, excluding Sundays and institution-specific holidays. If institution_name is NULL, only considers holidays marked for all institutions.';
