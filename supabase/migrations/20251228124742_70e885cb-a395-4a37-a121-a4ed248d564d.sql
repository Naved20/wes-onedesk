-- Add new columns to attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS half_day_type TEXT,
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS modified_by UUID,
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_status TEXT,
ADD COLUMN IF NOT EXISTS presence_value NUMERIC(3,2) DEFAULT 1.0;

-- Add constraint for half_day_type
ALTER TABLE attendance 
ADD CONSTRAINT attendance_half_day_type_check 
CHECK (half_day_type IS NULL OR half_day_type IN ('first_half', 'second_half'));

-- Create attendance audit table for tracking all modifications
CREATE TABLE public.attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for attendance_audit
CREATE POLICY "Admins can view all audit records" ON public.attendance_audit
FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view team audit records" ON public.attendance_audit
FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND 
  EXISTS (
    SELECT 1 FROM attendance a 
    WHERE a.id = attendance_audit.attendance_id 
    AND is_manager_of_user(auth.uid(), a.user_id)
  )
);

CREATE POLICY "Users can view their own audit records" ON public.attendance_audit
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM attendance a 
    WHERE a.id = attendance_audit.attendance_id 
    AND a.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert audit records" ON public.attendance_audit
FOR INSERT WITH CHECK (auth.uid() = changed_by);

CREATE POLICY "Admins can insert audit records" ON public.attendance_audit
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Function to check if current time is within check-in window (9 AM - 11 AM IST)
CREATE OR REPLACE FUNCTION public.is_within_checkin_window()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_hour INTEGER;
  v_current_minute INTEGER;
BEGIN
  -- Get current hour and minute in Indian Standard Time (UTC+5:30)
  v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Kolkata'));
  v_current_minute := EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Asia/Kolkata'));
  
  -- Check if within 9:00 AM to 11:00 AM
  RETURN (v_current_hour >= 9 AND v_current_hour < 11) OR 
         (v_current_hour = 11 AND v_current_minute = 0);
END;
$$;

-- Function to check if check-in is late (after 11 AM IST)
CREATE OR REPLACE FUNCTION public.is_late_checkin(p_check_in_time TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour INTEGER;
BEGIN
  v_hour := EXTRACT(HOUR FROM (p_check_in_time AT TIME ZONE 'Asia/Kolkata'));
  RETURN v_hour >= 11;
END;
$$;

-- Function to calculate monthly working days
CREATE OR REPLACE FUNCTION public.calculate_monthly_working_days(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  RETURN calculate_working_days(v_start_date, v_end_date);
END;
$$;

-- Function to calculate attendance statistics for a user in a month
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
    -- Only count late check-ins that are approved (so late only counts when the attendance is confirmed)
    AND is_late = true
    AND status = 'approved';
  
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
  -- Treat late days as counted towards present (they are approved check-ins)
  -- Effective present = Present (full) + Late (full) + Half days (0.5 each) + Casual leaves (100%) + Sick leaves (50%)
  v_effective_present := (v_present_days + v_late_days) + (v_half_days * 0.5) + v_casual_leaves + (v_sick_leaves * 0.5);
  
  -- Calculate absent days (account for late days as present)
  v_absent_days := GREATEST(0, v_working_days - (v_present_days + v_late_days) - (v_half_days * 0.5) - v_casual_leaves - v_sick_leaves - v_unplanned_leaves);
  
  -- Calculate attendance percentage
  IF v_working_days > 0 THEN
    v_percentage := (v_effective_present / v_working_days) * 100;
  ELSE
    v_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'working_days', v_working_days,
    -- Return present_days including late days for consistency with frontend payroll logic
    'present_days', (v_present_days + v_late_days),
    'half_days', v_half_days,
    'late_days', v_late_days,
    'pending_days', v_pending_days,
    'rejected_days', v_rejected_days,
    'casual_leaves', v_casual_leaves,
    'sick_leaves', v_sick_leaves,
    'unplanned_leaves', v_unplanned_leaves,
    'absent_days', v_absent_days,
    'effective_present', ROUND(v_effective_present, 1),
    'attendance_percentage', ROUND(LEAST(v_percentage, 100), 1)
  );
END;
$$;

-- Trigger function to handle attendance check-in logic
CREATE OR REPLACE FUNCTION public.handle_attendance_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark as late if check-in is after 11 AM IST
  IF NEW.check_in_time IS NOT NULL THEN
    NEW.is_late := is_late_checkin(NEW.check_in_time);
  END IF;
  
  -- Set presence value based on half-day status
  IF NEW.is_half_day THEN
    NEW.presence_value := 0.5;
  ELSE
    NEW.presence_value := 1.0;
  END IF;
  
  -- Add late note if applicable
  IF NEW.is_late AND (OLD IS NULL OR OLD.is_late = false) THEN
    NEW.notes := COALESCE(NEW.notes, '') || 
      CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' THEN ' | ' ELSE '' END ||
      'Late check-in flagged for review';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for attendance check-in handling
DROP TRIGGER IF EXISTS trigger_handle_attendance_checkin ON attendance;
CREATE TRIGGER trigger_handle_attendance_checkin
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION handle_attendance_checkin();

-- Trigger function to create audit record on attendance changes
CREATE OR REPLACE FUNCTION public.audit_attendance_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO attendance_audit (
      attendance_id, action, new_status, new_data, changed_by
    ) VALUES (
      NEW.id, 'created', NEW.status::TEXT, to_jsonb(NEW), NEW.user_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only create audit if status or key fields changed
    IF OLD.status IS DISTINCT FROM NEW.status OR 
       OLD.is_half_day IS DISTINCT FROM NEW.is_half_day OR
       OLD.admin_override IS DISTINCT FROM NEW.admin_override THEN
      INSERT INTO attendance_audit (
        attendance_id, action, old_status, new_status, old_data, new_data, 
        changed_by, change_reason
      ) VALUES (
        NEW.id, 
        CASE 
          WHEN NEW.status = 'approved' THEN 'approved'
          WHEN NEW.status = 'rejected' THEN 'rejected'
          WHEN NEW.admin_override AND NOT COALESCE(OLD.admin_override, false) THEN 'admin_override'
          ELSE 'modified'
        END,
        OLD.status::TEXT, 
        NEW.status::TEXT, 
        to_jsonb(OLD), 
        to_jsonb(NEW), 
        COALESCE(NEW.approved_by, NEW.modified_by, auth.uid()),
        NEW.rejection_reason
      );
    END IF;
    
    -- Track modification
    IF NEW.modified_by IS NOT NULL AND OLD.modified_by IS DISTINCT FROM NEW.modified_by THEN
      NEW.modified_at := now();
      NEW.original_status := COALESCE(OLD.original_status, OLD.status::TEXT);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for attendance audit
DROP TRIGGER IF EXISTS trigger_audit_attendance ON attendance;
CREATE TRIGGER trigger_audit_attendance
  AFTER INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_changes();