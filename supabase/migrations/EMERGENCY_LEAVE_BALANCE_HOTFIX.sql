-- HOTFIX: Emergency Leave Balance Not Deducting
-- Run this directly in Supabase SQL Editor

-- Step 1: Drop old trigger
DROP TRIGGER IF EXISTS update_balance_on_leave_approval ON leaves;

-- Step 2: Recreate the fixed function
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
    
    -- DEBUG: Log what we're doing
    RAISE NOTICE 'Updating balance: user_id=%, leave_type=%, days=%, month=%, year=%', 
                 NEW.user_id, NEW.leave_type, v_days, v_month, v_year;
    
    -- Update the appropriate balance based on leave type (with enum casting)
    IF NEW.leave_type = 'casual'::leave_type THEN
      UPDATE leave_balances
      SET casual_leaves_used = COALESCE(casual_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated casual leaves';
      
    ELSIF NEW.leave_type = 'emergency'::leave_type THEN
      UPDATE leave_balances
      SET emergency_leaves_used = COALESCE(emergency_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated emergency leaves';
      
    ELSIF NEW.leave_type = 'medical'::leave_type THEN
      UPDATE leave_balances
      SET medical_leaves_used = COALESCE(medical_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated medical leaves';
      
    ELSIF NEW.leave_type = 'lop'::leave_type THEN
      UPDATE leave_balances
      SET lop_leaves_used = COALESCE(lop_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated lop leaves';
      
    ELSIF NEW.leave_type = 'half_day'::leave_type THEN
      UPDATE leave_balances
      SET half_day_leaves_used = COALESCE(half_day_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated half_day leaves';
      
    ELSIF NEW.leave_type = 'sick'::leave_type THEN
      UPDATE leave_balances
      SET sick_leaves_used = COALESCE(sick_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated sick leaves';
      
    ELSIF NEW.leave_type = 'unplanned'::leave_type THEN
      UPDATE leave_balances
      SET unplanned_leaves_used = COALESCE(unplanned_leaves_used, 0) + v_days,
          updated_at = now()
      WHERE user_id = NEW.user_id AND year = v_year AND month = v_month;
      RAISE NOTICE 'Updated unplanned leaves';
    ELSE
      RAISE NOTICE 'Unknown leave type: %', NEW.leave_type;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Recreate the trigger with the fixed function
CREATE TRIGGER update_balance_on_leave_approval
  AFTER UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_approval();

-- Step 4: Verify trigger exists
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'leaves' AND trigger_name = 'update_balance_on_leave_approval';

-- Output: Should show the trigger is created
-- If no rows returned = PROBLEM!
