-- Rollback: Remove holiday records from attendance table
-- This removes the holiday status records that were inserted by the previous migration

-- Delete all records with status = 'holiday'
DELETE FROM attendance WHERE status = 'holiday';

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_attendance_status_date;

-- Revert ENUM back to original (without 'holiday')
ALTER TABLE attendance ALTER COLUMN status DROP DEFAULT;

CREATE TYPE attendance_status_old AS ENUM (
  'present',
  'approved',
  'absent',
  'paid_leave',
  'leave',
  'pending',
  'rejected'
);

ALTER TABLE attendance 
ALTER COLUMN status TYPE attendance_status_old USING status::text::attendance_status_old;

ALTER TABLE attendance ALTER COLUMN status SET DEFAULT 'pending'::attendance_status_old;

DROP TYPE IF EXISTS attendance_status;

ALTER TYPE attendance_status_old RENAME TO attendance_status;
