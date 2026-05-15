-- =====================================================
-- SIMPLE CHECK: Face Attendance Mismatch
-- =====================================================
-- Run each query separately in Supabase SQL Editor

-- Query 1: Check recent check-ins (last 10)
SELECT 
  fch.id,
  fch.user_id as history_user,
  ep.first_name || ' ' || ep.last_name as employee_name,
  fch.matched,
  fch.match_distance,
  fch.created_at
FROM face_checkin_history fch
LEFT JOIN employee_profiles ep ON fch.user_id = ep.user_id
ORDER BY fch.created_at DESC
LIMIT 10;

-- Query 2: Find mismatches (CRITICAL)
-- This shows if history user_id != attendance user_id
SELECT 
  fch.id,
  fch.user_id as history_user,
  a.user_id as attendance_user,
  ep1.first_name || ' ' || ep1.last_name as history_name,
  ep2.first_name || ' ' || ep2.last_name as attendance_name,
  fch.match_distance,
  fch.created_at
FROM face_checkin_history fch
LEFT JOIN attendance a ON fch.attendance_id = a.id
LEFT JOIN employee_profiles ep1 ON fch.user_id = ep1.user_id
LEFT JOIN employee_profiles ep2 ON a.user_id = ep2.user_id
WHERE fch.matched = true
  AND fch.user_id IS NOT NULL
  AND a.user_id IS NOT NULL
  AND fch.user_id != a.user_id
ORDER BY fch.created_at DESC
LIMIT 10;

-- Query 3: Match quality (last 24 hours)
SELECT 
  matched,
  COUNT(*) as count,
  AVG(match_distance) as avg_distance,
  MIN(match_distance) as min_distance,
  MAX(match_distance) as max_distance
FROM face_checkin_history
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND match_distance IS NOT NULL
GROUP BY matched;

-- Query 4: How many users enrolled?
SELECT 
  COUNT(*) as total_enrolled_faces,
  COUNT(DISTINCT user_id) as unique_users
FROM face_descriptors
WHERE is_active = true;

-- Query 5: Today's face check-ins
SELECT 
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE matched = true) as successful,
  COUNT(*) FILTER (WHERE matched = false) as failed
FROM face_checkin_history
WHERE DATE(created_at) = CURRENT_DATE;
