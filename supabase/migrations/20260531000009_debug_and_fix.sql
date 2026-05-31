-- Debug and Fix - Check what data exists and insert holidays properly

-- First, let's see how many active employees we have
-- SELECT COUNT(*) as active_employees FROM employee_profiles WHERE is_active = true;

-- Let's see how many holidays exist
-- SELECT COUNT(*) as total_holidays FROM holidays;

-- Let's see how many holiday records are in attendance
-- SELECT COUNT(*) as holiday_attendance_records FROM attendance WHERE status = 'holiday';

-- If no holidays exist, insert them
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

-- Add Sundays for 2026
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

-- Now insert holiday attendance records
-- Get all users (not just from employee_profiles, in case that's empty)
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
WHERE NOT EXISTS (
  SELECT 1 FROM attendance 
  WHERE date = h.date 
  AND user_id = u.id
)
ON CONFLICT (user_id, date) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_attendance_status_date 
ON attendance(status, date);
