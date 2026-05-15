-- =====================================================
-- FIX BAD ATTENDANCE RECORDS (High Match Distance)
-- =====================================================

-- Step 1: Find attendance records with suspiciously high match distance
-- These are likely WRONG person's attendance
SELECT 
  a.id as attendance_id,
  a.user_id,
  ep.first_name || ' ' || ep.last_name as employee_name,
  a.date,
  a.check_in_time,
  fch.match_distance,
  fch.id as history_id,
  a.notes,
  CASE 
    WHEN fch.match_distance > 0.50 THEN '🔴 VERY SUSPICIOUS'
    WHEN fch.match_distance > 0.40 THEN '🟡 SUSPICIOUS'
    WHEN fch.match_distance > 0.35 THEN '🟠 QUESTIONABLE'
    ELSE '✅ OK'
  END as confidence_level
FROM attendance a
JOIN face_checkin_history fch ON fch.attendance_id = a.id
JOIN employee_profiles ep ON a.user_id = ep.user_id
WHERE fch.match_distance > 0.35
  AND a.notes LIKE '%Face recognition%'
ORDER BY fch.match_distance DESC;

-- Step 2: Count suspicious records by confidence level
SELECT 
  CASE 
    WHEN fch.match_distance > 0.50 THEN 'VERY SUSPICIOUS (>0.50)'
    WHEN fch.match_distance > 0.40 THEN 'SUSPICIOUS (0.40-0.50)'
    WHEN fch.match_distance > 0.35 THEN 'QUESTIONABLE (0.35-0.40)'
    ELSE 'OK (<0.35)'
  END as confidence_level,
  COUNT(*) as count,
  AVG(fch.match_distance) as avg_distance
FROM attendance a
JOIN face_checkin_history fch ON fch.attendance_id = a.id
WHERE a.notes LIKE '%Face recognition%'
GROUP BY 
  CASE 
    WHEN fch.match_distance > 0.50 THEN 'VERY SUSPICIOUS (>0.50)'
    WHEN fch.match_distance > 0.40 THEN 'SUSPICIOUS (0.40-0.50)'
    WHEN fch.match_distance > 0.35 THEN 'QUESTIONABLE (0.35-0.40)'
    ELSE 'OK (<0.35)'
  END
ORDER BY avg_distance DESC;

-- Step 3: Find potential mismatches (different user in history vs attendance)
SELECT 
  fch.id as history_id,
  fch.user_id as history_user_id,
  ep1.first_name || ' ' || ep1.last_name as history_employee,
  a.id as attendance_id,
  a.user_id as attendance_user_id,
  ep2.first_name || ' ' || ep2.last_name as attendance_employee,
  fch.match_distance,
  a.date,
  a.check_in_time
FROM face_checkin_history fch
JOIN attendance a ON fch.attendance_id = a.id
LEFT JOIN employee_profiles ep1 ON fch.user_id = ep1.user_id
LEFT JOIN employee_profiles ep2 ON a.user_id = ep2.user_id
WHERE fch.user_id != a.user_id
  AND fch.matched = true
ORDER BY fch.created_at DESC;

-- Step 4: BACKUP before deletion (IMPORTANT!)
-- Create a backup table
CREATE TABLE IF NOT EXISTS attendance_backup_before_face_fix AS
SELECT 
  a.*,
  fch.match_distance,
  fch.notes as face_notes
FROM attendance a
LEFT JOIN face_checkin_history fch ON fch.attendance_id = a.id
WHERE a.notes LIKE '%Face recognition%';

-- Verify backup
SELECT COUNT(*) as backed_up_records FROM attendance_backup_before_face_fix;

-- Step 5: DELETE suspicious records (CAREFUL!)
-- Uncomment and run ONLY after reviewing Step 1 results

-- Option A: Delete VERY SUSPICIOUS records (distance > 0.50)
/*
DELETE FROM attendance
WHERE id IN (
  SELECT a.id
  FROM attendance a
  JOIN face_checkin_history fch ON fch.attendance_id = a.id
  WHERE fch.match_distance > 0.50
    AND a.notes LIKE '%Face recognition%'
);
*/

-- Option B: Delete SUSPICIOUS records (distance > 0.40)
/*
DELETE FROM attendance
WHERE id IN (
  SELECT a.id
  FROM attendance a
  JOIN face_checkin_history fch ON fch.attendance_id = a.id
  WHERE fch.match_distance > 0.40
    AND a.notes LIKE '%Face recognition%'
);
*/

-- Option C: Delete QUESTIONABLE records (distance > 0.35)
/*
DELETE FROM attendance
WHERE id IN (
  SELECT a.id
  FROM attendance a
  JOIN face_checkin_history fch ON fch.attendance_id = a.id
  WHERE fch.match_distance > 0.35
    AND a.notes LIKE '%Face recognition%'
);
*/

-- Step 6: Verify deletion
SELECT 
  'Before Fix' as status,
  COUNT(*) as total_face_attendance,
  COUNT(*) FILTER (WHERE fch.match_distance > 0.40) as suspicious_count,
  AVG(fch.match_distance) as avg_distance,
  MAX(fch.match_distance) as max_distance
FROM attendance a
JOIN face_checkin_history fch ON fch.attendance_id = a.id
WHERE a.notes LIKE '%Face recognition%';

-- Step 7: Restore from backup if needed
/*
-- If deletion was wrong, restore from backup:
INSERT INTO attendance 
SELECT 
  id, user_id, date, check_in_time, check_out_time, status, 
  shift_id, is_late, is_half_day, half_day_type, notes, 
  created_at, updated_at, admin_override, modified_by, 
  modified_at, original_status, calculated_status, presence_value,
  approved_by, approved_at, rejection_reason, is_manual_override
FROM attendance_backup_before_face_fix
WHERE id NOT IN (SELECT id FROM attendance);
*/

-- Step 8: Clean up backup table (after confirming fix works)
/*
DROP TABLE attendance_backup_before_face_fix;
*/
