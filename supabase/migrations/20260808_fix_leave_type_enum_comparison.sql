-- Fix: Cast leave_type comparisons to enum type in trigger functions

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
  
  -- ENFORCE: Casual leaves must be exactly 1 day per application
  IF NEW.leave_type = 'casual'::leave_type AND NEW.start_date != NEW.end_date THEN
    NEW.auto_rejected := true;
    NEW.auto_rejection_reason := 'Casual leaves are limited to exactly 1 day per application';
    NEW.status := 'rejected';
    NEW.working_days_count := v_working_days;
    RETURN NEW;
  END IF;
  
  -- Adjust for half day
  IF NEW.is_half_day THEN
    NEW.working_days_count := 0.5;
  ELSE
    NEW.working_days_count := v_working_days;
  END IF;
  
  -- Set salary deduction based on leave type
  IF NEW.leave_type = 'sick'::leave_type THEN
    NEW.salary_deduction_percent := 50;
  ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
    NEW.salary_deduction_percent := 100;
  ELSIF NEW.leave_type = 'casual'::leave_type OR NEW.leave_type = 'emergency'::leave_type THEN
    NEW.salary_deduction_percent := 0;
  END IF;
  
  -- Check eligibility (skip for emergency or if already auto_rejected)
  IF NEW.leave_type != 'emergency'::leave_type AND NOT NEW.auto_rejected THEN
    v_eligibility := check_leave_eligibility(
      NEW.user_id,
      NEW.start_date,
      NEW.end_date,
      NEW.leave_type,
      NEW.is_emergency
    );
    
    IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
      NEW.auto_rejected := true;
      NEW.auto_rejection_reason := v_eligibility->>'reason';
      NEW.status := 'rejected';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix check_leave_eligibility function
CREATE OR REPLACE FUNCTION public.check_leave_eligibility(p_user_id uuid, p_start_date date, p_end_date date, p_leave_type leave_type, p_is_emergency boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM p_start_date);
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_casual_used NUMERIC;
  v_week_start DATE;
  v_week_leaves INTEGER;
  v_advance_days INTEGER;
  v_working_days INTEGER;
BEGIN
  -- Calculate advance notice days
  v_advance_days := p_start_date - CURRENT_DATE;
  
  -- Calculate working days for this request
  v_working_days := calculate_working_days(p_start_date, p_end_date);
  
  -- ENFORCE: Casual leaves must be exactly 1 day per application
  IF p_leave_type = 'casual'::leave_type AND v_working_days > 1 THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Casual leaves are limited to exactly 1 day per application',
      'working_days', v_working_days
    );
  END IF;
  
  -- For casual leaves, check 3-day advance notice (unless emergency)
  IF p_leave_type = 'casual'::leave_type AND NOT p_is_emergency AND v_advance_days < 3 THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Casual leaves require minimum 3 days advance notice',
      'working_days', v_working_days
    );
  END IF;
  
  -- Check casual leave limit (2 per month)
  IF p_leave_type = 'casual'::leave_type THEN
    SELECT COALESCE(casual_leaves_used, 0)
    INTO v_casual_used
    FROM leave_balances
    WHERE user_id = p_user_id
      AND month = v_month
      AND year = v_year;
    
    IF v_casual_used IS NULL THEN
      v_casual_used := 0;
    END IF;
    
    -- Check if this request would exceed the limit (max 2 casual leaves per month)
    IF v_casual_used + v_working_days > 2 THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Monthly casual leave limit (2 days) reached. You have used ' || v_casual_used || ' day(s) and are requesting ' || v_working_days || ' more day(s). Maximum allowed: 2 days per month.',
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  -- Check weekly limit - REMOVED, should use LeaveRulesConfig
  -- The frontend validation in LeaveApplicationForm uses LeaveRulesConfig.max_per_week
  
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL,
    'working_days', v_working_days
  );
END;
$function$;
