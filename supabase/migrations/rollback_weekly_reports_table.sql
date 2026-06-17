-- Rollback: Drop all weekly reports related tables and policies

-- Drop RLS Policies
DROP POLICY IF EXISTS "Admins can manage all reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can review reports" ON weekly_reports;
DROP POLICY IF EXISTS "Employees can update their own draft reports" ON weekly_reports;
DROP POLICY IF EXISTS "Employees can create their own reports" ON weekly_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can view reports of their team members" ON weekly_reports;
DROP POLICY IF EXISTS "Employees can view their own reports" ON weekly_reports;

-- Drop related comments policies
DROP POLICY IF EXISTS "Admins can manage comments" ON weekly_report_comments;
DROP POLICY IF EXISTS "Users can view comments" ON weekly_report_comments;
DROP POLICY IF EXISTS "Users can add comments" ON weekly_report_comments;

-- Drop related tasks policies
DROP POLICY IF EXISTS "Admins manage tasks" ON weekly_report_tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON weekly_report_tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON weekly_report_tasks;

-- Drop related achievements policies
DROP POLICY IF EXISTS "Admins manage achievements" ON weekly_report_achievements;
DROP POLICY IF EXISTS "Users can view achievements" ON weekly_report_achievements;
DROP POLICY IF EXISTS "Users can update achievements" ON weekly_report_achievements;

-- Drop related challenges policies
DROP POLICY IF EXISTS "Admins manage challenges" ON weekly_report_challenges;
DROP POLICY IF EXISTS "Users can view challenges" ON weekly_report_challenges;
DROP POLICY IF EXISTS "Users can update challenges" ON weekly_report_challenges;

-- Drop related goals policies
DROP POLICY IF EXISTS "Admins manage goals" ON weekly_report_goals;
DROP POLICY IF EXISTS "Users can view goals" ON weekly_report_goals;
DROP POLICY IF EXISTS "Users can update goals" ON weekly_report_goals;

-- Drop Tables (in reverse order of creation due to foreign keys)
DROP TABLE IF EXISTS weekly_report_comments CASCADE;
DROP TABLE IF EXISTS weekly_report_goals CASCADE;
DROP TABLE IF EXISTS weekly_report_challenges CASCADE;
DROP TABLE IF EXISTS weekly_report_achievements CASCADE;
DROP TABLE IF EXISTS weekly_report_tasks CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;
