-- Fix attendance_effective_status and calculate_attendance_stats to handle not_applicable and leave statuses properly

CREATE OR REPLACE FUNCTION public.attendance_effective_status(
  p_status text,
  p_calculated_status text,
  p_is_half_day boolean,
  p_is_late boolean,
  p_check_in_time timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_calculated_status IN ('not_applicable', 'na') THEN 'not_applicable'
    WHEN p_status = 'holiday' OR p_calculated_status = 'holiday' THEN 'holiday'
    WHEN p_status = 'rejected' OR p_calculated_status = 'absent' THEN 'absent'
    WHEN p_calculated_status = 'paid_leave' THEN 'paid_leave'
    WHEN p_calculated_status = 'leave' THEN 'leave'
    WHEN p_calculated_status = 'half_day' OR COALESCE(p_is_half_day, false) THEN 'half_day'
    WHEN p_calculated_status = 'late' OR COALESCE(p_is_late, false) THEN 'late'
    WHEN p_calculated_status = 'present'
      OR p_check_in_time IS NOT NULL
      OR p_status IN ('approved','present') THEN 'present'
    ELSE 'pending'
  END
$$;

-- Ensure calculate_attendance_stats RPC is updated
CREATE OR REPLACE FUNCTION public.calculate_attendance_stats(p_user_id uuid, p_year integer, p_month integer)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payroll_days INTEGER;
  v_working_days INTEGER;
  v_present INTEGER := 0;
  v_late INTEGER := 0;
  v_half INTEGER := 0;
  v_paid_leave INTEGER := 0;
  v_leave INTEGER := 0;
  v_holiday INTEGER := 0;
  v_absent INTEGER := 0;
  v_pending INTEGER := 0;
  v_rejected INTEGER := 0;
  v_late_sets INTEGER := 0;
  v_present_total INTEGER := 0;
  v_total_paid NUMERIC := 0;
  v_percentage NUMERIC := 0;
BEGIN
  v_payroll_days := EXTRACT(DAY FROM (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
  v_working_days := calculate_monthly_working_days(p_year, p_month);

  SELECT
    COUNT(*) FILTER (WHERE eff = 'present'),
    COUNT(*) FILTER (WHERE eff = 'late'),
    COUNT(*) FILTER (WHERE eff = 'half_day'),
    COUNT(*) FILTER (WHERE eff = 'paid_leave'),
    COUNT(*) FILTER (WHERE eff = 'leave'),
    COUNT(*) FILTER (WHERE eff = 'holiday'),
    COUNT(*) FILTER (WHERE eff = 'absent'),
    COUNT(*) FILTER (WHERE eff = 'pending'),
    COUNT(*) FILTER (WHERE status::text = 'rejected')
  INTO v_present, v_late, v_half, v_paid_leave, v_leave, v_holiday, v_absent, v_pending, v_rejected
  FROM (
    SELECT
      a.status,
      attendance_effective_status(
        a.status::text, a.calculated_status::text, a.is_half_day, a.is_late, a.check_in_time
      ) AS eff
    FROM attendance a
    WHERE a.user_id = p_user_id
      AND EXTRACT(YEAR FROM a.date) = p_year
      AND EXTRACT(MONTH FROM a.date) = p_month
  ) t;

  -- Present total includes late days exactly once
  v_present_total := v_present + v_late;
  v_late_sets := FLOOR(v_late / 3.0);

  v_total_paid := GREATEST(
    0,
    v_present_total + v_holiday + (v_half * 0.5) + v_paid_leave - v_late_sets - v_absent
  );

  IF v_payroll_days > 0 THEN
    v_percentage := (v_total_paid / v_payroll_days) * 100;
  END IF;

  RETURN json_build_object(
    'payroll_days', v_payroll_days,
    'working_days', v_working_days,
    'present_days', v_present_total,
    'present_on_time', v_present,
    'late_days', v_late,
    'late_sets', v_late_sets,
    'half_days', v_half,
    'casual_leaves', v_paid_leave,
    'paid_leave_days', v_paid_leave,
    'sick_leaves', v_leave,
    'leave_days', v_leave,
    'unplanned_leaves', 0,
    'holiday_count', v_holiday,
    'absent_days', v_absent,
    'pending_days', v_pending,
    'rejected_days', v_rejected,
    'effective_present', ROUND(v_total_paid, 1),
    'total_paid_days', ROUND(v_total_paid, 1),
    'attendance_percentage', ROUND(LEAST(v_percentage, 100), 1)
  );
END;
$function$;
