-- Corrected migration: Merge holidays into attendance table
-- This version properly handles the holidays table data

-- Step 1: Drop default constraint first
ALTER TABLE attendance ALTER COLUMN status DROP DEFAULT;

-- Step 2: Create new ENUM type with 'holiday' status
CREATE TYPE attendance_status_new AS ENUM (
  'present',
  'approved',
  'absent',
  'paid_leave',
  'leave',
  'holiday',
  'pending',
  'rejected'
);

-- Step 3: Alter attendance table to use new ENUM
ALTER TABLE attendance 
ALTER COLUMN status TYPE attendance_status_new USING status::text::attendance_status_new;

-- Step 4: Set default back
ALTER TABLE attendance ALTER COLUMN status SET DEFAULT 'pending'::attendance_status_new;

-- Step 5: Drop old ENUM
DROP TYPE IF EXISTS attendance_status;

-- Step 6: Rename new ENUM to original name
ALTER TYPE attendance_status_new RENAME TO attendance_status;

-- Step 7: Insert holiday records for all active employees for each holiday date
-- This handles the case where some employees already have attendance records for holiday dates
INSERT INTO attendance (user_id, date, status, created_at)
SELECT 
  ep.user_id,
  h.date,
  'holiday'::attendance_status as status,
  NOW() as created_at
FROM holidays h
CROSS JOIN (
  SELECT DISTINCT user_id FROM employee_profiles WHERE is_active = true
) ep
WHERE NOT EXISTS (
  SELECT 1 FROM attendance 
  WHERE date = h.date 
  AND user_id = ep.user_id
)
ON CONFLICT (user_id, date) DO NOTHING;

-- Step 8: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_status_date 
ON attendance(status, date);

-- Step 9: Add comment
COMMENT ON COLUMN attendance.status IS 
'Attendance status: present, approved, absent, paid_leave, leave, holiday, pending, rejected';
