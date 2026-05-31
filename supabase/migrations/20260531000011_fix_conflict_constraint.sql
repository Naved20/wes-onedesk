-- Fix: Add unique constraint and then insert holidays

-- Step 1: Add unique constraint on (user_id, date) if it doesn't exist
ALTER TABLE attendance
ADD CONSTRAINT attendance_user_date_unique UNIQUE (user_id, date)
ON CONFLICT DO NOTHING;

-- Step 2: Ensure ENUM has 'holiday' status
DO $$
BEGIN
  ALTER TABLE attendance ALTER COLUMN status DROP DEFAULT;
  
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
  
  ALTER TABLE attendance 
  ALTER COLUMN status TYPE attendance_status_new USING status::text::attendance_status_new;
  
  ALTER TABLE attendance ALTER COLUMN status SET DEFAULT 'pending'::attendance_status_new;
  
  DROP TYPE IF EXISTS attendance_status;
  
  ALTER TYPE attendance_status_new RENAME TO attendance_status;
  
  RAISE NOTICE 'ENUM updated successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENUM already has holiday status or error: %', SQLERRM;
END $$;

-- Step 3: Ensure generate_sundays_for_year function exists
CREATE OR REPLACE FUNCTION generate_sundays_for_year(p_year INT)
RETURNS TABLE (sunday_date DATE)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := make_date(p_year, 1, 1);
  v_end_date := make_date(p_year, 12, 31);
  
  v_date := v_start_date;
  WHILE EXTRACT(DOW FROM v_date) != 0 LOOP
    v_date := v_date + INTERVAL '1 day';
  END LOOP;
  
  WHILE v_date <= v_end_date LOOP
    sunday_date := v_date;
    RETURN NEXT;
    v_date := v_date + INTERVAL '7 days';
  END LOOP;
END;
$$;

-- Step 4: Insert holidays if they don't exist
INSERT INTO holidays (name, date, is_national, description) 
VALUES
('Republic Day', '2026-01-26', true, 'National holiday'),
('Maha Shivaratri', '2026-02-13', true, 'Hindu festival'),
('Holi', '2026-03-29', true, 'Festival of colors'),
('Good Friday', '2026-04-10', true, 'Christian holiday'),
('Eid ul-Fitr', '2026-04-10', true, 'Islamic festival'),
('Buddha Purnima', '2026-05-03', true, 'Buddhist festival'),
('Eid ul-Adha', '2026-05-28', true, 'Islamic festival'),
('Independence Day', '2026-08-15', true, 'National holiday'),
('Janmashtami', '2026-09-07', true, 'Hindu festival'),
('Milad un-Nabi', '2026-09-24', true, 'Islamic holiday'),
('Mahatma Gandhi Jayanti', '2026-10-02', true, 'National holiday'),
('Dussehra', '2026-10-12', true, 'Hindu festival'),
('Diwali', '2026-11-08', true, 'Festival of lights'),
('Guru Nanak Jayanti', '2026-11-24', true, 'Sikh festival'),
('Christmas', '2026-12-25', true, 'Christian holiday')
ON CONFLICT (date) DO NOTHING;

-- Step 5: Add Sundays as holidays
INSERT INTO holidays (date, name, description, is_national)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true
FROM generate_sundays_for_year(2026)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
)
ON CONFLICT (date) DO NOTHING;

INSERT INTO holidays (date, name, description, is_national)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true
FROM generate_sundays_for_year(2025)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
)
ON CONFLICT (date) DO NOTHING;

INSERT INTO holidays (date, name, description, is_national)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true
FROM generate_sundays_for_year(2027)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
)
ON CONFLICT (date) DO NOTHING;

-- Step 6: Insert holiday attendance records using INSERT ... ON CONFLICT
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
ON CONFLICT (user_id, date) DO NOTHING;

-- Step 7: If no active employees, insert for all auth users
INSERT INTO attendance (user_id, date, status, created_at)
SELECT 
  u.id as user_id,
  h.date,
  'holiday'::attendance_status as status,
  NOW() as created_at
FROM holidays h
CROSS JOIN (
  SELECT DISTINCT id FROM auth.users
) u
ON CONFLICT (user_id, date) DO NOTHING;

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_status_date 
ON attendance(status, date);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date 
ON attendance(user_id, date);

-- Step 9: Add comment
COMMENT ON COLUMN attendance.status IS 
'Attendance status: present, approved, absent, paid_leave, leave, holiday, pending, rejected';
