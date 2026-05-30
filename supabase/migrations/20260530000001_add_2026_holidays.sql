-- Add 2026 Indian National Holidays
INSERT INTO public.holidays (name, date, is_national, description) VALUES
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
