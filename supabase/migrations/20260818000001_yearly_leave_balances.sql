-- Migration: Transition Leave Balances from Monthly to Yearly Model
-- Drop unique constraint on (user_id, year, month) and add UNIQUE(user_id, year)

-- 1. Merge duplicates and keep one record per user per year
CREATE OR REPLACE FUNCTION merge_monthly_leave_balances_to_yearly() 
RETURNS void AS $$
DECLARE
  v_rec record;
BEGIN
  -- Create temp table to store consolidated yearly balances
  CREATE TEMP TABLE temp_aggregated_balances AS
  SELECT 
    user_id,
    year,
    SUM(COALESCE(casual_leaves_used, 0)) as casual_leaves_used,
    MAX(COALESCE(casual_leaves_allocated, 0)) as casual_leaves_allocated,
    MAX(COALESCE(casual_leaves_entitled, 0)) as casual_leaves_entitled,
    
    SUM(COALESCE(medical_leaves_used, 0)) as medical_leaves_used,
    MAX(COALESCE(medical_leaves_allocated, 0)) as medical_leaves_allocated,
    
    SUM(COALESCE(emergency_leaves_used, 0)) as emergency_leaves_used,
    MAX(COALESCE(emergency_leaves_allocated, 0)) as emergency_leaves_allocated,
    
    SUM(COALESCE(lop_leaves_used, 0)) as lop_leaves_used,
    MAX(COALESCE(lop_leaves_allocated, 0)) as lop_leaves_allocated,
    
    SUM(COALESCE(half_day_leaves_used, 0)) as half_day_leaves_used,
    MAX(COALESCE(half_day_leaves_allocated, 0)) as half_day_leaves_allocated,
    
    SUM(COALESCE(sick_leaves_used, 0)) as sick_leaves_used,
    MAX(COALESCE(sick_leaves_allocated, 0)) as sick_leaves_allocated,
    
    SUM(COALESCE(unplanned_leaves_used, 0)) as unplanned_leaves_used,
    MAX(COALESCE(unplanned_leaves_allocated, 0)) as unplanned_leaves_allocated
  FROM public.leave_balances
  GROUP BY user_id, year;

  -- Delete all records from leave_balances
  DELETE FROM public.leave_balances;

  -- Reinsert aggregated records (defaulting month to 1)
  INSERT INTO public.leave_balances (
    user_id,
    year,
    month,
    casual_leaves_used, casual_leaves_allocated, casual_leaves_entitled,
    medical_leaves_used, medical_leaves_allocated,
    emergency_leaves_used, emergency_leaves_allocated,
    lop_leaves_used, lop_leaves_allocated,
    half_day_leaves_used, half_day_leaves_allocated,
    sick_leaves_used, sick_leaves_allocated,
    unplanned_leaves_used, unplanned_leaves_allocated
  )
  SELECT 
    user_id,
    year,
    1, -- Default month
    casual_leaves_used, casual_leaves_allocated, casual_leaves_entitled,
    medical_leaves_used, medical_leaves_allocated,
    emergency_leaves_used, emergency_leaves_allocated,
    lop_leaves_used, lop_leaves_allocated,
    half_day_leaves_used, half_day_leaves_allocated,
    sick_leaves_used, sick_leaves_allocated,
    unplanned_leaves_used, unplanned_leaves_allocated
  FROM temp_aggregated_balances;

  DROP TABLE temp_aggregated_balances;
END;
$$ LANGUAGE plpgsql;

-- Run the merge function
SELECT merge_monthly_leave_balances_to_yearly();
DROP FUNCTION merge_monthly_leave_balances_to_yearly();

-- 2. Modify constraints on leave_balances table
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_year_month_key;
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_year_month_idx;
ALTER TABLE public.leave_balances ALTER COLUMN month DROP NOT NULL;
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_user_id_year_key UNIQUE (user_id, year);

-- 3. Redefine get_or_create_leave_balance to operate yearly
CREATE OR REPLACE FUNCTION public.get_or_create_leave_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER DEFAULT NULL
) RETURNS leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance leave_balances;
BEGIN
  -- Search by user_id and year only
  SELECT * INTO v_balance
  FROM leave_balances
  WHERE user_id = p_user_id AND year = p_year;
  
  IF v_balance IS NULL THEN
    INSERT INTO leave_balances (
      user_id, 
      year, 
      month,
      casual_leaves_used, casual_leaves_allocated, casual_leaves_entitled,
      medical_leaves_used, medical_leaves_allocated,
      emergency_leaves_used, emergency_leaves_allocated,
      lop_leaves_used, lop_leaves_allocated,
      half_day_leaves_used, half_day_leaves_allocated,
      sick_leaves_used, sick_leaves_allocated,
      unplanned_leaves_used, unplanned_leaves_allocated
    )
    VALUES (
      p_user_id, 
      p_year, 
      1,
      0, 6, 6,
      0, 6,
      0, 6,
      0, 6,
      0, 6,
      0, 0,
      0, 0
    )
    RETURNING * INTO v_balance;
  END IF;
  
  RETURN v_balance;
END;
$$;

-- 4. Redefine update_leave_balance_on_approval trigger function
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_days NUMERIC;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_year := EXTRACT(YEAR FROM NEW.start_date);
    v_days := COALESCE(NEW.working_days_count, 1);
    
    -- Ensure balance record exists
    PERFORM get_or_create_leave_balance(NEW.user_id, v_year);
    
    -- Update the appropriate balance based on leave type (with enum casting)
    IF NEW.leave_type = 'casual'::leave_type THEN
      UPDATE leave_balances
      SET casual_leaves_used = COALESCE(casual_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'emergency'::leave_type THEN
      UPDATE leave_balances
      SET emergency_leaves_used = COALESCE(emergency_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'medical'::leave_type THEN
      UPDATE leave_balances
      SET medical_leaves_used = COALESCE(medical_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'lop'::leave_type THEN
      UPDATE leave_balances
      SET lop_leaves_used = COALESCE(lop_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'half_day'::leave_type THEN
      UPDATE leave_balances
      SET half_day_leaves_used = COALESCE(half_day_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'sick'::leave_type THEN
      UPDATE leave_balances
      SET sick_leaves_used = COALESCE(sick_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
      UPDATE leave_balances
      SET unplanned_leaves_used = COALESCE(unplanned_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Redefine check_leave_balance_sufficient function
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
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_balance_record RECORD;
  v_used NUMERIC;
  v_allocated NUMERIC;
  v_leave_type_str TEXT;
BEGIN
  v_leave_type_str := p_leave_type::TEXT;
  
  -- Get the balance record for this user/year
  SELECT * INTO v_balance_record
  FROM leave_balances
  WHERE user_id = p_user_id AND year = v_year;
  
  -- If no record found, create it or fail
  IF v_balance_record IS NULL THEN
    RETURN json_build_object(
      'sufficient', false,
      'reason', 'No leave balance allocation found for this year. Please ensure the user has a leave balance configured.'
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

-- 6. Redefine check_leave_eligibility to use yearly limits
CREATE OR REPLACE FUNCTION public.check_leave_eligibility(
  p_user_id uuid, 
  p_start_date date, 
  p_end_date date, 
  p_leave_type leave_type, 
  p_is_emergency boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_year_used NUMERIC;
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
      'reason', 'Maximum ' || v_rule.max_per_request || ' day(s) allowed per request. You requested ' || v_working_days || ' day(s).',
      'working_days', v_working_days
    );
  END IF;
  
  -- 2. Check advance notice (if required)
  IF v_rule.advance_notice_days > 0 AND NOT p_is_emergency AND v_advance_days < v_rule.advance_notice_days THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'This leave requires minimum ' || v_rule.advance_notice_days || ' days advance notice. You are applying with only ' || v_advance_days || ' day(s) notice.',
      'working_days', v_working_days
    );
  END IF;
  
  -- 3. Check yearly limit (max_per_month column acts as max_per_year now)
  v_year_used := 0;
  IF v_leave_type_str = 'casual' THEN
    SELECT COALESCE(casual_leaves_used, 0) INTO v_year_used
    FROM leave_balances
    WHERE user_id = p_user_id AND year = v_year;
  ELSIF v_leave_type_str = 'medical' THEN
    SELECT COALESCE(medical_leaves_used, 0) INTO v_year_used
    FROM leave_balances
    WHERE user_id = p_user_id AND year = v_year;
  ELSIF v_leave_type_str = 'emergency' THEN
    SELECT COALESCE(emergency_leaves_used, 0) INTO v_year_used
    FROM leave_balances
    WHERE user_id = p_user_id AND year = v_year;
  ELSIF v_leave_type_str = 'lop' THEN
    SELECT COALESCE(lop_leaves_used, 0) INTO v_year_used
    FROM leave_balances
    WHERE user_id = p_user_id AND year = v_year;
  ELSIF v_leave_type_str = 'half_day' THEN
    SELECT COALESCE(half_day_leaves_used, 0) INTO v_year_used
    FROM leave_balances
    WHERE user_id = p_user_id AND year = v_year;
  END IF;
  
  IF v_year_used IS NULL THEN
    v_year_used := 0;
  END IF;
  
  IF v_year_used + v_working_days > v_rule.max_per_month THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Yearly ' || v_leave_type_str || ' leave limit (' || v_rule.max_per_month || ' days) would be exceeded. You have used ' || CAST(v_year_used AS INTEGER) || ' day(s) and are requesting ' || v_working_days || ' more day(s).',
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
  IF v_week_leaves > 0 THEN
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
