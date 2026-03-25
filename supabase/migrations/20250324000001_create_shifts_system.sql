-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  late_threshold_minutes INTEGER DEFAULT 0, -- Minutes after start_time to mark as late
  half_day_threshold_hours DECIMAL(3,1) DEFAULT 2.5, -- Hours from start_time for half day
  last_checkin_hours_before_end DECIMAL(3,1) DEFAULT 3.5, -- Hours before end_time for last check-in
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create employee_shifts table for shift assignments
CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_employee_shifts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create attendance_rules table for global settings
CREATE TABLE IF NOT EXISTS attendance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) UNIQUE NOT NULL,
  rule_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add shift_id to attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id),
ADD COLUMN IF NOT EXISTS calculated_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_shifts_user_id ON employee_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_dates ON employee_shifts(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_attendance_shift_id ON attendance(shift_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date_user ON attendance(date, user_id);

-- Insert default attendance rules
INSERT INTO attendance_rules (rule_name, rule_value, description) VALUES
('auto_absence_enabled', 'true', 'Automatically mark as absent if no check-in'),
('grace_period_minutes', '5', 'Grace period for late check-in'),
('allow_early_checkin_minutes', '30', 'Allow check-in before shift start'),
('require_checkout', 'false', 'Require checkout for attendance')
ON CONFLICT (rule_name) DO NOTHING;

-- Create function to get employee's current shift
CREATE OR REPLACE FUNCTION get_employee_shift(p_user_id UUID, p_date DATE)
RETURNS TABLE (
  shift_id UUID,
  shift_name VARCHAR,
  start_time TIME,
  end_time TIME,
  late_threshold_minutes INTEGER,
  half_day_threshold_hours DECIMAL,
  last_checkin_hours_before_end DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.start_time,
    s.end_time,
    s.late_threshold_minutes,
    s.half_day_threshold_hours,
    s.last_checkin_hours_before_end
  FROM employee_shifts es
  JOIN shifts s ON es.shift_id = s.id
  WHERE es.user_id = p_user_id
    AND es.effective_from <= p_date
    AND (es.effective_to IS NULL OR es.effective_to >= p_date)
    AND s.is_active = true
  ORDER BY es.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate attendance status
CREATE OR REPLACE FUNCTION calculate_attendance_status(
  p_check_in_time TIMESTAMPTZ,
  p_shift_start TIME,
  p_shift_end TIME,
  p_late_threshold_minutes INTEGER,
  p_half_day_threshold_hours DECIMAL,
  p_last_checkin_hours_before_end DECIMAL
)
RETURNS VARCHAR AS $$
DECLARE
  v_check_in_time TIME;
  v_shift_start_ts TIMESTAMPTZ;
  v_half_day_limit_ts TIMESTAMPTZ;
  v_last_checkin_limit_ts TIMESTAMPTZ;
  v_shift_end_ts TIMESTAMPTZ;
BEGIN
  -- Extract time from check-in timestamp
  v_check_in_time := p_check_in_time::TIME;
  
  -- Create full timestamps for comparison
  v_shift_start_ts := DATE(p_check_in_time) + p_shift_start;
  v_half_day_limit_ts := v_shift_start_ts + (p_half_day_threshold_hours || ' hours')::INTERVAL;
  v_shift_end_ts := DATE(p_check_in_time) + p_shift_end;
  v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  
  -- Handle overnight shifts
  IF p_shift_end < p_shift_start THEN
    v_shift_end_ts := v_shift_end_ts + INTERVAL '1 day';
    v_last_checkin_limit_ts := v_shift_end_ts - (p_last_checkin_hours_before_end || ' hours')::INTERVAL;
  END IF;
  
  -- Determine status
  IF p_check_in_time >= v_last_checkin_limit_ts THEN
    RETURN 'absent';
  ELSIF p_check_in_time >= v_half_day_limit_ts THEN
    RETURN 'half_day';
  ELSIF p_check_in_time > (v_shift_start_ts + (p_late_threshold_minutes || ' minutes')::INTERVAL) THEN
    RETURN 'late';
  ELSE
    RETURN 'present';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_shifts_updated_at ON shifts;
DROP TRIGGER IF EXISTS update_employee_shifts_updated_at ON employee_shifts;
DROP TRIGGER IF EXISTS update_attendance_rules_updated_at ON attendance_rules;

-- Create triggers
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_shifts_updated_at BEFORE UPDATE ON employee_shifts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_rules_updated_at BEFORE UPDATE ON attendance_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default shifts
INSERT INTO shifts (name, description, start_time, end_time, late_threshold_minutes, half_day_threshold_hours, last_checkin_hours_before_end) VALUES
('Morning Shift', 'Standard morning shift', '09:00:00', '18:00:00', 1, 2.5, 3.5),
('Evening Shift', 'Evening shift', '14:00:00', '23:00:00', 1, 2.5, 3.5),
('Night Shift', 'Night shift', '22:00:00', '07:00:00', 1, 2.5, 3.5)
ON CONFLICT DO NOTHING;