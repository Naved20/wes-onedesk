-- Function to create absent records for employees who didn't check in
-- This will create actual database records instead of fake frontend records

CREATE OR REPLACE FUNCTION public.create_absent_records_for_date(p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_employee RECORD;
BEGIN
  -- Don't create absent records for future dates
  IF p_date > CURRENT_DATE THEN
    RETURN 0;
  END IF;

  -- Don't create absent records for holidays (including Sundays)
  IF is_holiday_date(p_date) THEN
    RETURN 0;
  END IF;

  -- Loop through all employees who don't have attendance record for this date
  FOR v_employee IN 
    SELECT ep.user_id
    FROM employee_profiles ep
    WHERE NOT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.user_id = ep.user_id
      AND a.date = p_date
    )
  LOOP
    -- Create absent record
    INSERT INTO attendance (
      user_id,
      date,
      check_in_time,
      check_out_time,
      status,
      calculated_status,
      is_late,
      is_half_day,
      half_day_type,
      notes,
      shift_id,
      is_manual_override,
      created_at,
      updated_at
    ) VALUES (
      v_employee.user_id,
      p_date,
      NULL,
      NULL,
      'rejected',
      'absent',
      false,
      false,
      NULL,
      'Auto-marked absent - No check-in',
      NULL,
      false,
      NOW(),
      NOW()
    );
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Function to create absent records for a date range
CREATE OR REPLACE FUNCTION public.create_absent_records_for_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(date DATE, records_created INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date DATE;
  v_count INTEGER;
BEGIN
  v_current_date := p_start_date;
  
  WHILE v_current_date <= p_end_date LOOP
    -- Create absent records for this date
    v_count := create_absent_records_for_date(v_current_date);
    
    -- Return the result
    date := v_current_date;
    records_created := v_count;
    RETURN NEXT;
    
    -- Move to next date
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.create_absent_records_for_date(DATE) IS 
'Creates absent records for all employees who did not check in on the specified date. Skips holidays and Sundays.';

COMMENT ON FUNCTION public.create_absent_records_for_range(DATE, DATE) IS 
'Creates absent records for a date range. Returns a table showing how many records were created for each date.';

-- Example usage (commented out - run manually when needed):
-- To create absent records for today:
-- SELECT create_absent_records_for_date(CURRENT_DATE);

-- To create absent records for last 30 days:
-- SELECT * FROM create_absent_records_for_range(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day');

-- To create absent records for a specific month (e.g., March 2026):
-- SELECT * FROM create_absent_records_for_range('2026-03-01', '2026-03-31');
