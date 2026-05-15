-- =====================================================
-- DIAGNOSE FACE ATTENDANCE MISMATCH ISSUE
-- =====================================================

-- 1. Check enrolled faces count
SELECT 
  COUNT(*) as total_enrolled_faces,
  COUNT(DISTINCT user_id) as unique_users_enrolled
FROM face_descriptors
WHERE is_active = true;

-- 2. Check if multiple descriptors exist for same user
SELECT 
  user_id,
  COUNT(*) as descriptor_count,
  STRING_AGG(id::text, ', ') as descriptor_ids
FROM face_descriptors
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 3. Check recent face check-in history with mismatches
SELECT 
  fch.id,
  fch.user_id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  fch.matched,
  fch.match_distance,
  fch.notes,
  fch.created_at,
  fch.attendance_id
FROM face_checkin_history fch
LEFT JOIN employee_profiles ep ON fch.user_id = ep.user_id
ORDER BY fch.created_at DESC
LIMIT 20;

-- 4. Check attendance records created by face recognition
SELECT 
  a.id,
  a.user_id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.date,
  a.check_in_time,
  a.status,
  a.notes,
  a.created_at
FROM attendance a
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE a.notes LIKE '%Face recognition%'
ORDER BY a.created_at DESC
LIMIT 20;

-- 5. Find potential mismatches (history says one person, attendance says another)
SELECT 
  fch.id as history_id,
  fch.user_id as history_user_id,
  ep1.first_name || ' ' || ep1.last_name as history_employee,
  fch.attendance_id,
  a.user_id as attendance_user_id,
  ep2.first_name || ' ' || ep2.last_name as attendance_employee,
  fch.match_distance,
  fch.created_at,
  CASE 
    WHEN fch.user_id = a.user_id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status
FROM face_checkin_history fch
LEFT JOIN employee_profiles ep1 ON fch.user_id = ep1.user_id
LEFT JOIN attendance a ON fch.attendance_id = a.id
LEFT JOIN employee_profiles ep2 ON a.user_id = ep2.user_id
WHERE fch.matched = true
  AND fch.attendance_id IS NOT NULL
ORDER BY fch.created_at DESC
LIMIT 20;

-- 6. Check for duplicate face descriptors (same descriptor for multiple users)
WITH descriptor_hashes AS (
  SELECT 
    user_id,
    id,
    MD5(descriptor::text) as descriptor_hash
  FROM face_descriptors
  WHERE is_active = true
)
SELECT 
  descriptor_hash,
  COUNT(*) as user_count,
  STRING_AGG(user_id::text, ', ') as user_ids
FROM descriptor_hashes
GROUP BY descriptor_hash
HAVING COUNT(*) > 1;

-- 7. Check face_checkin_history table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'face_checkin_history'
ORDER BY ordinal_position;

-- 8. Recent failed attempts (not enrolled)
SELECT 
  fch.id,
  fch.user_id,
  fch.matched,
  fch.match_distance,
  fch.notes,
  fch.created_at
FROM face_checkin_history fch
WHERE fch.matched = false
ORDER BY fch.created_at DESC
LIMIT 10;

-- 9. Match quality statistics (last 24 hours)
SELECT 
  matched,
  COUNT(*) as count,
  ROUND(AVG(match_distance)::numeric, 3) as avg_distance,
  ROUND(MIN(match_distance)::numeric, 3) as min_distance,
  ROUND(MAX(match_distance)::numeric, 3) as max_distance
FROM face_checkin_history
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND match_distance IS NOT NULL
GROUP BY matched;

-- 10. Today's attendance summary
SELECT 
  DATE(a.created_at) as date,
  COUNT(*) as total_checkins,
  COUNT(DISTINCT a.user_id) as unique_employees,
  COUNT(*) FILTER (WHERE a.notes LIKE '%Face recognition%') as face_checkins,
  COUNT(*) FILTER (WHERE a.notes NOT LIKE '%Face recognition%') as manual_checkins
FROM attendance a
WHERE DATE(a.created_at) = CURRENT_DATE
GROUP BY DATE(a.created_at);
