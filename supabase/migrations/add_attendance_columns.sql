-- Add missing attendance columns to salaries table
ALTER TABLE salaries
ADD COLUMN IF NOT EXISTS half_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_leaves INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS holiday_count INTEGER DEFAULT 0;

-- Add comment to document these columns
COMMENT ON COLUMN salaries.half_days IS 'Number of half days worked in the month (saved from attendance table)';
COMMENT ON COLUMN salaries.sick_leaves IS 'Number of sick leaves taken in the month (saved from attendance table)';
COMMENT ON COLUMN salaries.late_days IS 'Number of late check-ins in the month (saved from attendance table)';
COMMENT ON COLUMN salaries.holiday_count IS 'Number of holidays not worked in the month (saved from attendance table)';
