-- Fix: Cast leave_type comparisons to enum type in trigger functions
-- Also add handling for new leave types: medical, lop, half_day
-- This fixes the "operator does not exist: character varying = leave_type" error

-- Fix the update_leave_balance_on_approval trigger function
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
  v_days NUMERIC;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_month := EXTRACT(MONTH FROM NEW.start_date);
    v_year := EXTRACT(YEAR FROM NEW.start_date);
    v_days := COALESCE(NEW.working_days_count, 1);
    
    -- Ensure balance record exists
    PERFORM get_or_create_leave_balance(NEW.user_id, v_year, v_month);
    
    -- Update the appropriate balance based on leave type (with enum casting)
    IF NEW.leave_type = 'casual'::leave_type OR NEW.leave_type = 'emergency'::leave_type THEN
      UPDATE leave_balances
      SET casual_leaves_used = casual_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'medical'::leave_type THEN
      UPDATE leave_balances
      SET medical_leaves_used = COALESCE(medical_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'lop'::leave_type THEN
      UPDATE leave_balances
      SET lop_leaves_used = COALESCE(lop_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'half_day'::leave_type THEN
      UPDATE leave_balances
      SET half_day_leaves_used = COALESCE(half_day_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'sick'::leave_type THEN
      UPDATE leave_balances
      SET sick_leaves_used = sick_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
      UPDATE leave_balances
      SET unplanned_leaves_used = unplanned_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix validate_leave_request function with enum casts
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
  
  -- Set salary deduction based on leave type (with enum casting)
  IF NEW.leave_type = 'sick'::leave_type THEN
    NEW.salary_deduction_percent := 50;
  ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
    NEW.salary_deduction_percent := 100;
  ELSIF NEW.leave_type = 'lop'::leave_type THEN
    NEW.salary_deduction_percent := 100;
  ELSIF NEW.leave_type = 'half_day'::leave_type THEN
    NEW.salary_deduction_percent := 50;
  ELSIF NEW.leave_type = 'casual'::leave_type OR NEW.leave_type = 'medical'::leave_type OR NEW.leave_type = 'emergency'::leave_type THEN
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

-- Fix check_leave_eligibility function with enum casts
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
        'reason', 'Monthly casual leave limit (2 days) reached. You have used ' || CAST(v_casual_used AS INTEGER) || ' day(s) and are requesting ' || CAST(v_working_days AS INTEGER) || ' more day(s). Maximum allowed: 2 days per month.',
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  -- Check weekly limit - uses LeaveRulesConfig max_per_week (validated on frontend)
  -- Database validation focuses on basic eligibility only
  
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL,
    'working_days', v_working_days
  );
END;
$function$;
