-- Prevent absent records from being created on holidays
-- This migration adds a trigger to prevent employees from being marked as absent on holidays

-- Create or replace the function to check if a date is a holiday
CREATE OR REPLACE FUNCTION public.is_holiday_date(p_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if it's Sunday (day of week = 0) OR in holidays table
  RETURN EXTRACT(DOW FROM p_date) = 0 OR EXISTS (
    SELECT 1 FROM holidays 
    WHERE date = p_date
  );
END;
$$;

-- Create or replace the function to prevent absent on holidays
CREATE OR REPLACE FUNCTION public.prevent_absent_on_holidays()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If trying to create/update an absent record on a holiday, prevent it
  IF (NEW.status = 'rejected' OR NEW.calculated_status = 'absent') AND 
     is_holiday_date(NEW.date::DATE) THEN
    -- Raise an exception to prevent the insert/update
    RAISE EXCEPTION 'Cannot mark attendance as absent on a holiday';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_prevent_absent_on_holidays ON attendance;

-- Create trigger to prevent absent on holidays
CREATE TRIGGER trigger_prevent_absent_on_holidays
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_absent_on_holidays();

-- Add comment
COMMENT ON FUNCTION public.prevent_absent_on_holidays() IS 
'Prevents employees from being marked as absent on holidays. Raises an exception if attempted.';
