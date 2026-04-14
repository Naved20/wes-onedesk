-- Update default late_threshold_minutes from 1 to 15 minutes
ALTER TABLE shifts ALTER COLUMN late_threshold_minutes SET DEFAULT 15;

-- Update existing shifts with late_threshold_minutes = 1 to 15
UPDATE shifts SET late_threshold_minutes = 15 WHERE late_threshold_minutes = 1;
