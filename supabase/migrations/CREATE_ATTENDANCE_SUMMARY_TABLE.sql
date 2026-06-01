-- Create a new table to store attendance summary data for all employees
-- This table will store the attendance data shown on the Attendance page

CREATE TABLE IF NOT EXISTS attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Attendance counts
  payroll_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  half_days INTEGER DEFAULT 0,
  holiday_count INTEGER DEFAULT 0,
  paid_leave_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  late_days INTEGER DEFAULT 0,
  late_sets INTEGER DEFAULT 0,
  
  -- Calculated values
  total_paid_days DECIMAL(10, 2) DEFAULT 0,
  attendance_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per employee per month
  UNIQUE(user_id, year, month)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_summary_user_month 
ON attendance_summary(user_id, year, month);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_year_month 
ON attendance_summary(year, month);

-- Add comment to document the table
COMMENT ON TABLE attendance_summary IS 'Stores attendance summary data for all employees by month. Data is fetched from attendance table and saved here for reporting and salary calculations.';

COMMENT ON COLUMN attendance_summary.payroll_days IS 'Total days in the month (e.g., 31 for May)';
COMMENT ON COLUMN attendance_summary.present_days IS 'Number of days employee was present';
COMMENT ON COLUMN attendance_summary.half_days IS 'Number of half days worked';
COMMENT ON COLUMN attendance_summary.holiday_count IS 'Number of holidays not worked (Total Holidays - Holidays Worked)';
COMMENT ON COLUMN attendance_summary.paid_leave_days IS 'Number of paid leave days taken';
COMMENT ON COLUMN attendance_summary.leave_days IS 'Number of sick leaves taken';
COMMENT ON COLUMN attendance_summary.absent_days IS 'Number of days absent';
COMMENT ON COLUMN attendance_summary.late_days IS 'Number of late check-ins';
COMMENT ON COLUMN attendance_summary.late_sets IS 'Number of late sets (3 lates = 1 set)';
COMMENT ON COLUMN attendance_summary.total_paid_days IS 'PR + HO + (HD × 0.5) + PL - Late Sets - (AB × 2) - LE';
COMMENT ON COLUMN attendance_summary.attendance_percentage IS 'Attendance percentage for the month';
