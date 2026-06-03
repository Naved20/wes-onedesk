
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'attendance_status' AND e.enumlabel = 'holiday'
  ) THEN
    ALTER TYPE attendance_status ADD VALUE 'holiday';
  END IF;
END$$;
