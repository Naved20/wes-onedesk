-- Fix: Respect manual override for is_late field
-- This allows admins to manually set is_late without trigger overwriting it

CREATE OR REPLACE FUNCTION public.handle_attendance_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-calculate is_late if NOT a manual override
  -- If is_manual_override is true, admin has explicitly set the value
  IF NEW.check_in_time IS NOT NULL AND (NEW.is_manual_override IS NULL OR NEW.is_manual_override = false) THEN
    NEW.is_late := is_late_checkin(NEW.check_in_time);
  END IF;
  
  -- Set presence value based on half-day status
  IF NEW.is_half_day THEN
    NEW.presence_value := 0.5;
  ELSE
    NEW.presence_value := 1.0;
  END IF;
  
  -- Add late note if applicable (only for auto-calculated late, not manual override)
  IF NEW.is_late AND (OLD IS NULL OR OLD.is_late = false) AND (NEW.is_manual_override IS NULL OR NEW.is_manual_override = false) THEN
    NEW.notes := COALESCE(NEW.notes, '') || 
      CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' THEN ' | ' ELSE '' END ||
      'Late check-in flagged for review';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.handle_attendance_checkin() IS 
'Handles attendance check-in logic. Respects is_manual_override flag to allow admin manual edits of is_late field.';
