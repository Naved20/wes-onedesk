CREATE OR REPLACE FUNCTION public.calculate_attendance_stats(p_user_id uuid, p_year integer, p_month integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_working_days := calculate_monthly_working_days(p_year, p_month);
  
  -- Count approved full-day attendance where the day is actually a present/late workday
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = false
    AND (calculated_status IN ('present', 'late') OR calculated_status IS NULL);
  
  SELECT COALESCE(COUNT(*), 0)
  INTO v_half_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_half_day = true;
  
  -- Late check-ins only count when the record is approved (so rejected lates don't inflate)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_late_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND is_late = true
    AND status = 'approved';
  
  SELECT COALESCE(COUNT(*), 0)
  INTO v_present_on_time
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'approved'
    AND is_late = false
    AND is_half_day = false
    AND (calculated_status IN ('present') OR calculated_status IS NULL);
  
  SELECT COALESCE(COUNT(*), 0)
  INTO v_pending_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'pending';
  
  SELECT COALESCE(COUNT(*), 0)
  INTO v_rejected_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND status = 'rejected';
  
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
  
  v_effective_present := v_present_days + (v_half_days * 0.5) + v_casual_leaves + (v_sick_leaves * 0.5);
  
  SELECT COALESCE(
    SUM(CASE WHEN is_half_day THEN 0.5 ELSE 1 END), 
    0
  )
  INTO v_absent_days
  FROM attendance
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month
    AND (calculated_status = 'absent' OR status = 'rejected')
    AND date <= CURRENT_DATE;
  
  IF v_working_days > 0 THEN
    v_percentage := ROUND((v_effective_present / v_working_days) * 100, 1);
  ELSE
    v_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'working_days', v_working_days,
    'present_days', v_present_days,
    'half_days', v_half_days,
    'late_days', v_late_days,
    'present_on_time', v_present_on_time,
    'pending_days', v_pending_days,
    'rejected_days', v_rejected_days,
    'casual_leaves', v_casual_leaves,
    'sick_leaves', v_sick_leaves,
    'unplanned_leaves', v_unplanned_leaves,
    'absent_days', v_absent_days,
    'effective_present', v_effective_present,
    'attendance_percentage', v_percentage
  );
END;
$function$;