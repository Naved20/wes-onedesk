-- Add institution_name column to holidays table
ALTER TABLE public.holidays
ADD COLUMN institution_name TEXT;

-- Remove the unique constraint on date (since same date can have different holidays for different institutions)
ALTER TABLE public.holidays
DROP CONSTRAINT IF EXISTS holidays_date_key;

-- Add composite unique constraint (one holiday per date per institution)
ALTER TABLE public.holidays
ADD CONSTRAINT holidays_unique_per_institution 
UNIQUE (date, institution_name);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_holidays_institution ON public.holidays(institution_name);

-- Update existing holidays to have NULL institution_name (means applicable to all institutions)
-- This maintains backward compatibility
UPDATE public.holidays
SET institution_name = NULL
WHERE institution_name IS NULL;

COMMENT ON COLUMN public.holidays.institution_name IS 'Institution name for institution-specific holidays. NULL means holiday applies to all institutions.';
