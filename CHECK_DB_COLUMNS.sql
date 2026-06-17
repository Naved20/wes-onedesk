-- Run this in Supabase SQL Editor to see actual table structure

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'weekly_reports'
ORDER BY ordinal_position;

-- Also check if any data exists
SELECT * FROM weekly_reports LIMIT 1;
