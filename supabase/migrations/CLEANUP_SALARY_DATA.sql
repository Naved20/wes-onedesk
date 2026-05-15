-- =====================================================
-- CLEANUP SALARY DATA
-- =====================================================
-- This script cleans up duplicate salary structures and empty salary records

-- 1. Find and display duplicate active salary structures
SELECT 
  user_id,
  COUNT(*) as active_count,
  STRING_AGG(id::text, ', ') as structure_ids
FROM salary_structures
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 2. Deactivate duplicate salary structures (keep only the most recent one)
WITH ranked_structures AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) as rn
  FROM salary_structures
  WHERE is_active = true
)
UPDATE salary_structures
SET is_active = false
WHERE id IN (
  SELECT id 
  FROM ranked_structures 
  WHERE rn > 1
);

-- 3. Delete empty salary records from May 2026 (base_salary = 0)
DELETE FROM salaries 
WHERE month = 5 
  AND year = 2026 
  AND base_salary = 0;

-- 4. Verify cleanup - should show 0 or 1 active structure per user
SELECT 
  user_id,
  COUNT(*) as active_count
FROM salary_structures
WHERE is_active = true
GROUP BY user_id
ORDER BY active_count DESC;

-- 5. Check remaining salary records for May 2026
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN base_salary > 0 THEN 1 END) as with_salary,
  COUNT(CASE WHEN base_salary = 0 THEN 1 END) as without_salary
FROM salaries
WHERE month = 5 AND year = 2026;
