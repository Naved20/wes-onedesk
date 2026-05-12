-- Add seniority column to employee_profiles table

-- Add seniority column after designation
ALTER TABLE public.employee_profiles 
ADD COLUMN IF NOT EXISTS seniority TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.employee_profiles.seniority IS 'Employee seniority level (e.g., Junior, Mid-level, Senior, Lead, Principal)';

-- Create index for faster filtering by seniority
CREATE INDEX IF NOT EXISTS idx_employee_profiles_seniority 
ON public.employee_profiles(seniority) 
WHERE seniority IS NOT NULL;

-- Update existing records (optional - set default seniority if needed)
-- UPDATE public.employee_profiles 
-- SET seniority = 'Mid-level' 
-- WHERE seniority IS NULL AND designation IS NOT NULL;
