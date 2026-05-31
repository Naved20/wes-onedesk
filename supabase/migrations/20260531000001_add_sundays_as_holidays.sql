-- Add all Sundays as holidays for 2026
-- This ensures all holidays (including Sundays) are stored in one place

-- Function to generate all Sundays for a given year
CREATE OR REPLACE FUNCTION generate_sundays_for_year(p_year INT)
RETURNS TABLE (sunday_date DATE)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Start from January 1st of the year
  v_start_date := make_date(p_year, 1, 1);
  v_end_date := make_date(p_year, 12, 31);
  
  -- Find the first Sunday
  v_date := v_start_date;
  WHILE EXTRACT(DOW FROM v_date) != 0 LOOP
    v_date := v_date + INTERVAL '1 day';
  END LOOP;
  
  -- Generate all Sundays
  WHILE v_date <= v_end_date LOOP
    sunday_date := v_date;
    RETURN NEXT;
    v_date := v_date + INTERVAL '7 days';
  END LOOP;
END;
$$;

-- Insert all Sundays for 2026 as holidays (if not already exists)
-- Skip dates that already have a holiday (due to UNIQUE constraint on date)
INSERT INTO holidays (date, name, description, is_national, institution_name)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true,
  NULL
FROM generate_sundays_for_year(2026)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
);

-- Also add Sundays for 2025 and 2027 for continuity
INSERT INTO holidays (date, name, description, is_national, institution_name)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true,
  NULL
FROM generate_sundays_for_year(2025)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
);

INSERT INTO holidays (date, name, description, is_national, institution_name)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true,
  NULL
FROM generate_sundays_for_year(2027)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
);

-- Create a trigger to automatically add Sundays when a new year starts
CREATE OR REPLACE FUNCTION auto_add_sundays_for_new_year()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INT;
BEGIN
  -- Extract year from the inserted holiday
  v_year := EXTRACT(YEAR FROM NEW.date);
  
  -- Check if we need to add Sundays for this year
  IF NOT EXISTS (
    SELECT 1 FROM holidays 
    WHERE EXTRACT(YEAR FROM date) = v_year 
    AND name = 'Sunday'
    LIMIT 1
  ) THEN
    -- Add all Sundays for this year (skip dates that already have holidays)
    INSERT INTO holidays (date, name, description, is_national, institution_name)
    SELECT 
      sunday_date,
      'Sunday',
      'Weekly Off',
      true,
      NULL
    FROM generate_sundays_for_year(v_year)
    WHERE NOT EXISTS (
      SELECT 1 FROM holidays 
      WHERE date = sunday_date
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_auto_add_sundays ON holidays;
CREATE TRIGGER trigger_auto_add_sundays
  AFTER INSERT ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_sundays_for_new_year();

COMMENT ON FUNCTION generate_sundays_for_year(INT) IS 
'Generates all Sunday dates for a given year';

COMMENT ON FUNCTION auto_add_sundays_for_new_year() IS 
'Automatically adds all Sundays as holidays when a new year is detected';
