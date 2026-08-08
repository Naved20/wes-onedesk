-- Update validate_leave_request trigger function - validates using LeaveRulesConfig
CREATE OR REPLACE FUNCTION public.validate_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_eligibility JSON;
  v_working_days INTEGER;
BEGIN
  -- Calculate working days
  v_working_days := calculate_working_days(NEW.start_date, NEW.end_date);
  
  -- Adjust for half day
  IF NEW.is_half_day THEN
    NEW.working_days_count := 0.5;
  ELSE
    NEW.working_days_count := v_working_days;
  END IF;
  
  -- Set salary deduction based on leave_balance_config
  IF NEW.leave_type IS NOT NULL THEN
    SELECT salary_impact_percent INTO NEW.salary_deduction_percent
    FROM leave_balance_config
    WHERE leave_type = NEW.leave_type;
  END IF;
  
  -- Emergency leaves bypass eligibility checks
  IF NEW.is_emergency THEN
    RETURN NEW;
  END IF;
  
  -- Check eligibility for non-emergency leaves
  v_eligibility := check_leave_eligibility(
    NEW.user_id,
    NEW.start_date,
    NEW.end_date,
    NEW.leave_type
  );
  
  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    NEW.auto_rejected := true;
    NEW.auto_rejection_reason := v_eligibility->>'reason';
    NEW.status := 'rejected';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update check_leave_eligibility to validate against LeaveRulesConfig
CREATE OR REPLACE FUNCTION public.check_leave_eligibility(p_user_id uuid, p_start_date date, p_end_date date, p_leave_type leave_type)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM p_start_date);
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_week_start DATE;
  v_week_leaves NUMERIC;
  v_month_leaves NUMERIC;
  v_advance_days INTEGER;
  v_working_days INTEGER;
  v_rule record;
BEGIN
  -- Get leave type rule from LeaveRulesConfig
  SELECT * INTO v_rule
  FROM leave_rules_config
  WHERE leave_type = p_leave_type;
  
  IF v_rule IS NULL THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Leave type rules not configured: ' || p_leave_type
    );
  END IF;
  
  -- Calculate advance notice days
  v_advance_days := p_start_date - CURRENT_DATE;
  
  -- Calculate working days for this request
  v_working_days := calculate_working_days(p_start_date, p_end_date);
  
  -- Check 1: Max days per request
  IF v_working_days > v_rule.max_per_request THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Maximum ' || v_rule.max_per_request || ' days per request allowed. You requested ' || v_working_days || ' days.'
    );
  END IF;
  
  -- Check 2: Advance notice
  IF v_rule.advance_notice_days > 0 AND v_advance_days < v_rule.advance_notice_days THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', p_leave_type || ' leave requires ' || v_rule.advance_notice_days || ' days advance notice. You are applying with only ' || v_advance_days || ' days notice.'
    );
  END IF;
  
  -- Check 3: Max per week
  v_week_start := date_trunc('week', p_start_date)::DATE;
  SELECT COALESCE(SUM(calculate_working_days(start_date, end_date)), 0)
  INTO v_week_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND leave_type = p_leave_type
    AND status = 'approved'
    AND start_date >= v_week_start
    AND start_date < v_week_start + INTERVAL '7 days';
  
  IF v_week_leaves + v_working_days > v_rule.max_per_week THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Maximum ' || v_rule.max_per_week || ' days per week allowed. You have ' || v_week_leaves::INTEGER || ' days approved and are requesting ' || v_working_days || ' more days this week.'
    );
  END IF;
  
  -- Check 4: Max per month
  SELECT COALESCE(SUM(calculate_working_days(start_date, end_date)), 0)
  INTO v_month_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND leave_type = p_leave_type
    AND status = 'approved'
    AND EXTRACT(MONTH FROM start_date) = v_month
    AND EXTRACT(YEAR FROM start_date) = v_year;
  
  IF v_month_leaves + v_working_days > v_rule.max_per_month THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Maximum ' || v_rule.max_per_month || ' days per month allowed. You have ' || v_month_leaves::INTEGER || ' days approved and are requesting ' || v_working_days || ' more days this month.'
    );
  END IF;
  
  -- Check 5: Minimum gap between requests
  IF v_rule.min_gap_between_requests > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM leaves
      WHERE user_id = p_user_id
        AND leave_type = p_leave_type
        AND status = 'approved'
        AND end_date >= (p_start_date - (v_rule.min_gap_between_requests || ' days')::INTERVAL)
        AND end_date < p_start_date
      LIMIT 1
    ) THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Minimum ' || v_rule.min_gap_between_requests || ' days gap required between ' || p_leave_type || ' leave requests.'
      );
    END IF;
  END IF;
  
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL
  );
END;
$function$;

-- Create function to get casual leave count for a user in a month
CREATE OR REPLACE FUNCTION public.get_casual_leave_count(p_user_id uuid, p_year integer, p_month integer)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.leaves
  WHERE user_id = p_user_id
    AND leave_type = 'casual'
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month;
$function$;
