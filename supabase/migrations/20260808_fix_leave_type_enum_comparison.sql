-- Fix: Cast leave_type comparisons to enum type in trigger functions
-- Also add handling for new leave types: medical, lop, half_day
-- This fixes the "operator does not exist: character varying = leave_type" error

-- Fix the update_leave_balance_on_approval trigger function
-- FIXED: Properly deducts balance for each leave type (was incorrectly grouping emergency with casual)
-- Drop old trigger first to ensure we rebind to the new function
DROP TRIGGER IF EXISTS update_balance_on_leave_approval ON leaves;

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
    -- FIXED: Each leave type now updates its own column
    IF NEW.leave_type = 'casual'::leave_type THEN
      UPDATE leave_balances
      SET casual_leaves_used = COALESCE(casual_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'emergency'::leave_type THEN
      UPDATE leave_balances
      SET emergency_leaves_used = COALESCE(emergency_leaves_used, 0) + v_days,
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
      SET sick_leaves_used = COALESCE(sick_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
      UPDATE leave_balances
      SET unplanned_leaves_used = COALESCE(unplanned_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger to ensure it binds to the fixed function
CREATE TRIGGER update_balance_on_leave_approval
  AFTER UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_approval();

-- Add validation function to check if user has sufficient balance before approving
-- This prevents approving leaves when balance is insufficient
CREATE OR REPLACE FUNCTION public.check_leave_balance_sufficient(
  p_user_id uuid,
  p_leave_type leave_type,
  p_working_days NUMERIC,
  p_start_date date
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM p_start_date);
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_balance_record RECORD;
  v_used NUMERIC;
  v_allocated NUMERIC;
  v_leave_type_str TEXT;
BEGIN
  v_leave_type_str := p_leave_type::TEXT;
  
  -- Get the balance record for this user/month/year
  SELECT * INTO v_balance_record
  FROM leave_balances
  WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  
  -- If no record found, there's no balance - cannot approve
  IF v_balance_record IS NULL THEN
    RETURN json_build_object(
      'sufficient', false,
      'reason', 'No leave balance allocation found for this month. Please ensure the user has a leave balance configured.'
    );
  END IF;
  
  -- Check the specific leave type balance
  IF v_leave_type_str = 'casual' THEN
    v_used := COALESCE(v_balance_record.casual_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.casual_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'emergency' THEN
    v_used := COALESCE(v_balance_record.emergency_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.emergency_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'medical' THEN
    v_used := COALESCE(v_balance_record.medical_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.medical_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'lop' THEN
    v_used := COALESCE(v_balance_record.lop_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.lop_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'half_day' THEN
    v_used := COALESCE(v_balance_record.half_day_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.half_day_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'sick' THEN
    v_used := COALESCE(v_balance_record.sick_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.sick_leaves_allocated, 0);
  ELSIF v_leave_type_str = 'unplanned' THEN
    v_used := COALESCE(v_balance_record.unplanned_leaves_used, 0);
    v_allocated := COALESCE(v_balance_record.unplanned_leaves_allocated, 0);
  END IF;
  
  -- Check if user has sufficient balance
  IF v_used + p_working_days > v_allocated THEN
    RETURN json_build_object(
      'sufficient', false,
      'reason', 'Insufficient ' || v_leave_type_str || ' leave balance. Allocated: ' || v_allocated::INTEGER || ' days, Used: ' || v_used::INTEGER || ' days, Requesting: ' || p_working_days::INTEGER || ' days. Remaining balance: ' || (v_allocated - v_used)::INTEGER || ' days.'
    );
  END IF;
  
  -- Sufficient balance
  RETURN json_build_object(
    'sufficient', true,
    'reason', NULL,
    'allocated', v_allocated::INTEGER,
    'used', v_used::INTEGER,
    'remaining', (v_allocated - v_used)::INTEGER
  );
END;
$function$;


-- Removed hardcoded 1-day casual leave restriction (now uses leave_rules_config)
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
-- NOW USES RULES FROM leave_rules_config TABLE INSTEAD OF HARDCODING
CREATE OR REPLACE FUNCTION public.check_leave_eligibility(p_user_id uuid, p_start_date date, p_end_date date, p_leave_type leave_type, p_is_emergency boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM p_start_date);
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_month_used NUMERIC;
  v_week_start DATE;
  v_week_leaves INTEGER;
  v_advance_days INTEGER;
  v_working_days INTEGER;
  v_rule RECORD;
  v_leave_type_str TEXT;
BEGIN
  -- Convert leave_type enum to text for database lookup
  v_leave_type_str := p_leave_type::TEXT;
  
  -- Get rules for this leave type from leave_rules_config
  SELECT max_per_request, max_per_week, max_per_month, min_gap_between_requests, advance_notice_days
  INTO v_rule
  FROM leave_rules_config
  WHERE leave_type = v_leave_type_str;
  
  -- If no rule found, allow the leave (fail open)
  IF v_rule IS NULL THEN
    RETURN json_build_object(
      'eligible', true,
      'reason', NULL,
      'working_days', calculate_working_days(p_start_date, p_end_date)
    );
  END IF;
  
  -- Calculate advance notice days
  v_advance_days := p_start_date - CURRENT_DATE;
  
  -- Calculate working days for this request
  v_working_days := calculate_working_days(p_start_date, p_end_date);
  
  -- 1. Check max per request
  IF v_working_days > v_rule.max_per_request THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Maximum ' || v_rule.max_per_request || ' days per request allowed. You requested ' || v_working_days || ' days.',
      'working_days', v_working_days
    );
  END IF;
  
  -- 2. Check advance notice (if required)
  IF v_rule.advance_notice_days > 0 AND NOT p_is_emergency AND v_advance_days < v_rule.advance_notice_days THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'This leave requires minimum ' || v_rule.advance_notice_days || ' days advance notice. You are applying with only ' || v_advance_days || ' days notice.',
      'working_days', v_working_days
    );
  END IF;
  
  -- 3. Check monthly limit
  -- Get current month's used days for this leave type
  v_month_used := 0;
  IF v_leave_type_str = 'casual' THEN
    SELECT COALESCE(casual_leaves_used, 0) INTO v_month_used
    FROM leave_balances
    WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  ELSIF v_leave_type_str = 'medical' THEN
    SELECT COALESCE(medical_leaves_used, 0) INTO v_month_used
    FROM leave_balances
    WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  ELSIF v_leave_type_str = 'emergency' THEN
    SELECT COALESCE(emergency_leaves_used, 0) INTO v_month_used
    FROM leave_balances
    WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  ELSIF v_leave_type_str = 'lop' THEN
    SELECT COALESCE(lop_leaves_used, 0) INTO v_month_used
    FROM leave_balances
    WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  ELSIF v_leave_type_str = 'half_day' THEN
    SELECT COALESCE(half_day_leaves_used, 0) INTO v_month_used
    FROM leave_balances
    WHERE user_id = p_user_id AND month = v_month AND year = v_year;
  END IF;
  
  IF v_month_used IS NULL THEN
    v_month_used := 0;
  END IF;
  
  IF v_month_used + v_working_days > v_rule.max_per_month THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Monthly ' || v_leave_type_str || ' leave limit (' || v_rule.max_per_month || ' days) would be exceeded. You have used ' || CAST(v_month_used AS INTEGER) || ' day(s) and are requesting ' || v_working_days || ' more day(s).',
      'working_days', v_working_days
    );
  END IF;
  
  -- 4. Check weekly limit
  v_week_start := date_trunc('week', p_start_date)::DATE;
  -- Count existing leaves in same week for this leave type
  SELECT COUNT(*)
  INTO v_week_leaves
  FROM leaves
  WHERE user_id = p_user_id
    AND leave_type = p_leave_type
    AND status IN ('approved', 'pending')
    AND auto_rejected = false
    AND start_date >= v_week_start
    AND start_date < v_week_start + INTERVAL '7 days'
    AND id IS NOT NULL; -- Existing leaves only
  
  -- Sum up working days from existing leaves in the same week
  -- We'll check if adding this request would exceed max_per_week
  IF v_week_leaves > 0 THEN
    -- For simplicity: if there's already a leave this week, flag it if requesting more than allowed
    -- More precise calculation would sum working days from existing leaves
    IF v_rule.max_per_week <= 1 THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Maximum ' || v_rule.max_per_week || ' ' || v_leave_type_str || ' leave application(s) per week allowed. You already have a pending/approved leave this week.',
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  -- All checks passed
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL,
    'working_days', v_working_days
  );
END;
$function$;
