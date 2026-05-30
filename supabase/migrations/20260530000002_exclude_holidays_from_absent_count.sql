-- Exclude holidays from absent count
-- When a date is a holiday, it should not be counted as absent

CREATE OR REPLACE FUNCTION public.calculate_attendance_stats(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_working_days INTEGER;
  v_present_days NUMERIC;
  v_half_days NUMERIC;
  v_late_days INTEGER;
  v_pending_days INTEGER;
  v_rejected_days INTEGER;
  v_casual_leaves NUMERIC;
  v_sick_leaves NUMERIC;
  v_unplanned_leaves NUMERIC;
  v_absent_days NUMERIC;
  v_percentage NUMERIC;
  v_effective_present NUMERIC;
  v_present_on_time INTEGER;
BEGIN
  -- Calculate total working days for the month
  v_working_days := calculate_monthly_working_days(p_year, p_month);
  
  -- Count approved full-day attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = false;
  
  -- Count approved half-day attendance (each counts as 0.5)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_half_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = true;
  
  -- Count late check-ins
  SELECT COALESCE(COUNT(*), 0)
  INTO v_late_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND is_late = true;
  
  -- Count present on time (not late)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_on_time
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_late = false
    AND is_half_day = false;
  
  -- Count pending attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_pending_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'pending';
  
  -- Count rejected attendance
  SELECT COALESCE(COUNT(*), 0)
  INTO v_rejected_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'rejected';
  
  -- Count approved casual leaves (100% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_casual_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type IN ('casual', 'emergency');
  
  -- Count approved sick leaves (50% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_sick_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type = 'sick';
  
  -- Count unplanned leaves (0% present value)
  SELECT COALESCE(SUM(
    CASE WHEN is_half_day THEN 0.5 ELSE COALESCE(working_days_count, 1) END
  ), 0)
  INTO v_unplanned_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month
    AND status = 'approved'
    AND leave_type = 'unplanned';
  
  -- Calculate effective present days
  -- Present (full) + Half days (0.5 each) + Casual leaves (100%) + Sick leaves (50%)
  v_effective_present := v_present_days + (v_half_days * 0.5) + v_casual_leaves + (v_sick_leaves * 0.5);
  
  -- FIXED: Count actual absent records from database, excluding holidays
  -- Exclude dates that are holidays from absent count
  SELECT COALESCE(
    SUM(CASE WHEN a.is_half_day THEN 0.5 ELSE 1 END), 
    0
  )
  INTO v_absent_days
  FROM attendance a
  WHERE a.user_id = p_user_id
    AND EXTRACT(YEAR FROM a.date) = p_year
    AND EXTRACT(MONTH FROM a.date) = p_month
    AND (a.calculated_status = 'absent' OR a.status = 'rejected')
    AND a.date <= CURRENT_DATE  -- Only count past and today's absents
    AND NOT EXISTS (
      -- Exclude dates that are holidays
      SELECT 1 FROM holidays h
      WHERE h.date = a.date
    )
    AND EXTRACT(DOW FROM a.date) != 0;  -- Also exclude Sundays (day of week 0)
  
  -- Calculate attendance percentage
  IF v_working_days > 0 THEN
    v_percentage := (v_effective_present / v_working_days) * 100;
  ELSE
    v_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'working_days', v_working_days,
    'present_days', v_present_days,
    'half_days', v_half_days,
    'late_days', v_late_days,
    'pending_days', v_pending_days,
    'rejected_days', v_rejected_days,
    'casual_leaves', v_casual_leaves,
    'sick_leaves', v_sick_leaves,
    'unplanned_leaves', v_unplanned_leaves,
    'absent_days', v_absent_days,
    'effective_present', ROUND(v_effective_present, 1),
    'attendance_percentage', ROUND(LEAST(v_percentage, 100), 1),
    'present_on_time', v_present_on_time
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_attendance_stats(UUID, INTEGER, INTEGER) IS 
'Calculates attendance statistics for a user in a specific month. Excludes holidays and Sundays from absent count.';
