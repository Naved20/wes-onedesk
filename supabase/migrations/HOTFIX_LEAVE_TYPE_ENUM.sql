-- HOTFIX: Leave Type Enum Casting Issue
-- This fixes the "operator does not exist: character varying = leave_type" error
-- Run this directly in Supabase SQL Editor

-- Fix validate_leave_request function
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
  
  -- Set salary deduction based on leave type (from leave_balance_config)
  NEW.salary_deduction_percent := 0; -- Default, will be set by app
  
  -- Check eligibility (skip for emergency)
  IF NEW.leave_type::text != 'emergency' THEN
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
  v_month INTEGER := EXTRACT(MONTH FROM p_start_date);
  v_year INTEGER := EXTRACT(YEAR FROM p_start_date);
  v_used NUMERIC;
  v_week_start DATE;
  v_week_leaves INTEGER;
  v_advance_days INTEGER;
  v_working_days INTEGER;
  
  v_max_per_request INTEGER;
  v_max_per_week INTEGER;
  v_max_per_month INTEGER;
  v_min_gap_days INTEGER;
  v_advance_notice_days INTEGER;
BEGIN
  v_advance_days := p_start_date - CURRENT_DATE;
  v_working_days := calculate_working_days(p_start_date, p_end_date);
  
  -- Fetch rules with proper type casting
  SELECT 
    max_per_request,
    max_per_week,
    max_per_month,
    min_gap_between_requests,
    advance_notice_days
  INTO 
    v_max_per_request,
    v_max_per_week,
    v_max_per_month,
    v_min_gap_days,
    v_advance_notice_days
  FROM leave_rules_config
  WHERE leave_type::text = p_leave_type::text;
  
  IF NOT FOUND THEN
    v_max_per_request := 1;
    v_max_per_week := 2;
    v_max_per_month := 6;
    v_min_gap_days := 0;
    v_advance_notice_days := 0;
  END IF;
  
  -- Rule 1: Check max days per request
  IF v_working_days > v_max_per_request THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Maximum ' || v_max_per_request || ' day(s) allowed per request. You requested ' || v_working_days || ' day(s).',
      'working_days', v_working_days
    );
  END IF;
  
  -- Rule 2: Check advance notice
  IF NOT p_is_emergency AND v_advance_days < v_advance_notice_days THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'This leave type requires ' || v_advance_notice_days || ' days advance notice. You are applying with only ' || v_advance_days || ' day(s) notice.',
      'working_days', v_working_days
    );
  END IF;
  
  -- Rule 3: Check monthly limit
  SELECT COALESCE(SUM(working_days_count), 0)
  INTO v_used
  FROM leaves
  WHERE user_id = p_user_id
    AND leave_type::text = p_leave_type::text
    AND status = 'approved'
    AND auto_rejected = false
    AND EXTRACT(YEAR FROM start_date) = v_year
    AND EXTRACT(MONTH FROM start_date) = v_month;
  
  IF v_used IS NULL THEN
    v_used := 0;
  END IF;
  
  IF v_used + v_working_days > v_max_per_month THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Monthly ' || p_leave_type::text || ' leave limit (' || v_max_per_month || ' days) would be exceeded. You have used ' || v_used || ' day(s) and are requesting ' || v_working_days || ' more day(s).',
      'working_days', v_working_days
    );
  END IF;
  
  -- Rule 4: Check weekly limit
  IF NOT p_is_emergency THEN
    v_week_start := date_trunc('week', p_start_date)::DATE;
    SELECT COALESCE(SUM(working_days_count), 0)
    INTO v_week_leaves
    FROM leaves
    WHERE user_id = p_user_id
      AND leave_type::text = p_leave_type::text
      AND status = 'approved'
      AND auto_rejected = false
      AND start_date >= v_week_start
      AND start_date < v_week_start + INTERVAL '7 days';
    
    IF v_week_leaves IS NULL THEN
      v_week_leaves := 0;
    END IF;
    
    IF v_week_leaves + v_working_days > v_max_per_week THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Weekly ' || p_leave_type::text || ' leave limit (' || v_max_per_week || ' days) would be exceeded. You have ' || v_week_leaves || ' day(s) approved in this week.',
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  -- Rule 5: Check minimum gap
  IF NOT p_is_emergency AND v_min_gap_days > 0 THEN
    v_week_start := COALESCE((
      SELECT MAX(end_date) + (v_min_gap_days || ' days')::INTERVAL
      FROM leaves
      WHERE user_id = p_user_id
        AND leave_type::text = p_leave_type::text
        AND status = 'approved'
        AND auto_rejected = false
    ), CURRENT_DATE);
    
    IF p_start_date <= v_week_start THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Minimum ' || v_min_gap_days || ' day(s) gap required between ' || p_leave_type::text || ' leave requests.',
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL,
    'working_days', v_working_days
  );
END;
$function$;

-- Verify the fix
SELECT 'Functions updated successfully' AS status;
