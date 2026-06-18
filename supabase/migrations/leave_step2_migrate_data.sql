-- STEP 2: Run this AFTER Step 1 is committed
-- Migrate old data to new leave types

UPDATE leaves SET leave_type = 'medical' WHERE leave_type = 'sick';
UPDATE leaves SET leave_type = 'lop' WHERE leave_type = 'unplanned';

-- Migrate old balance data
UPDATE leave_balances SET medical_leaves_used = sick_leaves_used WHERE sick_leaves_used > 0;
UPDATE leave_balances SET lop_leaves_used = unplanned_leaves_used WHERE unplanned_leaves_used > 0;
