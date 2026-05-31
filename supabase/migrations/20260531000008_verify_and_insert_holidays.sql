-- Verify and Insert Holidays - Complete Fix
-- This migration checks if holidays exist and inserts them if needed

-- Step 1: First, ensure the ENUM has 'holiday' status
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

-- Step 2: Check if holidays table has data, if not insert them
INSERT INTO holidays (name, date, is_national, description) 
VALUES
('Republic Day', '2026-01-26', true, 'National holiday celebrating the adoption of the Constitution'),
('Maha Shivaratri', '2026-02-13', true, 'Hindu festival'),
('Holi', '2026-03-29', true, 'Festival of colors'),
('Good Friday', '2026-04-10', true, 'Christian holiday'),
('Eid ul-Fitr', '2026-04-10', true, 'Islamic festival marking end of Ramadan'),
('Buddha Purnima', '2026-05-03', true, 'Buddhist festival'),
('Eid ul-Adha', '2026-05-28', true, 'Islamic festival of sacrifice'),
('Independence Day', '2026-08-15', true, 'National holiday celebrating independence'),
('Janmashtami', '2026-09-07', true, 'Hindu festival celebrating birth of Krishna'),
('Milad un-Nabi', '2026-09-24', true, 'Islamic holiday celebrating Prophet Muhammad birthday'),
('Mahatma Gandhi Jayanti', '2026-10-02', true, 'National holiday celebrating Gandhi birthday'),
('Dussehra', '2026-10-12', true, 'Hindu festival'),
('Diwali', '2026-11-08', true, 'Festival of lights'),
('Guru Nanak Jayanti', '2026-11-24', true, 'Sikh festival'),
('Christmas', '2026-12-25', true, 'Christian holiday')
ON CONFLICT (date) DO NOTHING;

-- Step 3: Add all Sundays for 2026 as holidays
INSERT INTO holidays (date, name, description, is_national, institution_name)
SELECT 
  sunday_date,
  'Sunday',
  'Weekly Off',
  true,
  NULL
FROM generate_sundays_for_year(2026)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays 
  WHERE date = sunday_date
)
ON CONFLICT (date) DO NOTHING;

-- Step 4: Now insert holiday records into attendance table for all active employees
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

-- Step 5: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_status_date 
ON attendance(status, date);

-- Step 6: Add comment
COMMENT ON COLUMN attendance.status IS 
'Attendance status: present, approved, absent, paid_leave, leave, holiday, pending, rejected';
