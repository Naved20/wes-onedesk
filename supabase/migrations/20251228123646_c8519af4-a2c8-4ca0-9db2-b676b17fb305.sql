-- Create leave type enum
CREATE TYPE leave_type AS ENUM ('casual', 'sick', 'unplanned', 'emergency');

-- Add new columns to leaves table
ALTER TABLE leaves
ADD COLUMN leave_type leave_type DEFAULT 'casual',
ADD COLUMN is_half_day BOOLEAN DEFAULT false,
ADD COLUMN half_day_type TEXT CHECK (half_day_type IN ('first_half', 'second_half', NULL)),
ADD COLUMN medical_document_url TEXT,
ADD COLUMN working_days_count INTEGER DEFAULT 1,
ADD COLUMN salary_deduction_percent INTEGER DEFAULT 0,
ADD COLUMN auto_rejected BOOLEAN DEFAULT false,
ADD COLUMN auto_rejection_reason TEXT;

-- Create leave balances table
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  casual_leaves_entitled INTEGER DEFAULT 2,
  casual_leaves_used NUMERIC(3,1) DEFAULT 0,
  sick_leaves_used NUMERIC(3,1) DEFAULT 0,
  unplanned_leaves_used NUMERIC(3,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- Enable RLS on leave_balances
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_balances
CREATE POLICY "Users can view their own balance" ON public.leave_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balance" ON public.leave_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own balance" ON public.leave_balances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all balances" ON public.leave_balances
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view team balances" ON public.leave_balances
  FOR SELECT USING (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of_user(auth.uid(), user_id));

-- Function to calculate working days (excluding Sundays and holidays)
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE := p_start_date;
BEGIN
  WHILE v_current <= p_end_date LOOP
    -- Skip Sundays (0 = Sunday in PostgreSQL)
    IF EXTRACT(DOW FROM v_current) != 0 THEN
      -- Check if not a holiday
      IF NOT EXISTS (
        SELECT 1 FROM holidays 
        WHERE date = v_current
      ) THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    v_current := v_current + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Function to check leave eligibility
CREATE OR REPLACE FUNCTION public.check_leave_eligibility(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_leave_type leave_type,
  p_is_emergency BOOLEAN DEFAULT false
) RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- For casual leaves, check 3-day advance notice (unless emergency)
  IF p_leave_type = 'casual' AND NOT p_is_emergency AND v_advance_days < 3 THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Casual leaves require minimum 3 days advance notice',
      'working_days', v_working_days
    );
  END IF;
  
  -- Check casual leave limit (2 per month)
  IF p_leave_type = 'casual' THEN
    SELECT COALESCE(casual_leaves_used, 0)
    INTO v_casual_used
    FROM leave_balances
    WHERE user_id = p_user_id
      AND month = v_month
      AND year = v_year;
    
    IF v_casual_used IS NULL THEN
      v_casual_used := 0;
    END IF;
    
    IF v_casual_used + v_working_days > 2 THEN
      RETURN json_build_object(
        'eligible', false,
        'reason', 'Monthly casual leave limit (2 days) would be exceeded. Used: ' || v_casual_used || ', Requesting: ' || v_working_days,
        'working_days', v_working_days
      );
    END IF;
  END IF;
  
  -- Check weekly limit - REMOVED (should be handled by application logic using LeaveRulesConfig)
  -- The frontend validation in LeaveApplicationForm uses LeaveRulesConfig values
  
  RETURN json_build_object(
    'eligible', true,
    'reason', NULL,
    'working_days', v_working_days
  );
END;
$$;

-- Function to get or create leave balance for a user/month
CREATE OR REPLACE FUNCTION public.get_or_create_leave_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance leave_balances;
BEGIN
  SELECT * INTO v_balance
  FROM leave_balances
  WHERE user_id = p_user_id AND year = p_year AND month = p_month;
  
  IF v_balance IS NULL THEN
    INSERT INTO leave_balances (user_id, year, month)
    VALUES (p_user_id, p_year, p_month)
    RETURNING * INTO v_balance;
  END IF;
  
  RETURN v_balance;
END;
$$;

-- Trigger to auto-calculate working days and validate on insert
CREATE OR REPLACE FUNCTION public.validate_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Set salary deduction based on leave type
  IF NEW.leave_type = 'sick' THEN
    NEW.salary_deduction_percent := 50;
  ELSIF NEW.leave_type = 'unplanned' THEN
    NEW.salary_deduction_percent := 100;
  ELSIF NEW.leave_type = 'casual' OR NEW.leave_type = 'emergency' THEN
    NEW.salary_deduction_percent := 0;
  END IF;
  
  -- Check eligibility (skip for emergency or if already auto_rejected)
  IF NEW.leave_type != 'emergency' AND NOT NEW.auto_rejected THEN
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
$$;

CREATE TRIGGER validate_leave_before_insert
  BEFORE INSERT ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION validate_leave_request();

-- Trigger to update leave balances when leave is approved
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
    
    -- Update the appropriate balance
    IF NEW.leave_type = 'casual' OR NEW.leave_type = 'emergency' THEN
      UPDATE leave_balances
      SET casual_leaves_used = casual_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE leave_balances
      SET sick_leaves_used = sick_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    ELSIF NEW.leave_type = 'unplanned' THEN
      UPDATE leave_balances
      SET unplanned_leaves_used = unplanned_leaves_used + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_balance_on_leave_approval
  AFTER UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_approval();