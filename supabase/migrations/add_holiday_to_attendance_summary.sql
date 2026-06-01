-- Add 1 holiday to all employees' attendance summary for May (month 5)
-- This will update the holiday_count column for all records in May

UPDATE attendance_summary
SET 
  holiday_count = holiday_count + 1,
  total_paid_days = total_paid_days + 1,
  attendance_percentage = ROUND((total_paid_days + 1) / payroll_days * 100, 2),
  updated_at = NOW()
WHERE 
  month = 5
  AND year = 2026;

-- Verify the update
SELECT 
  user_id,
  year,
  month,
  holiday_count,
  total_paid_days,
  attendance_percentage,
  updated_at
FROM attendance_summary
WHERE month = 5
AND year = 2026
ORDER BY user_id;
