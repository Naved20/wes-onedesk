-- Drop old weekly reports system
-- Run this BEFORE applying wes_academy_weekly_reports.sql

-- Drop views first
DROP VIEW IF EXISTS manager_weekly_reports_view CASCADE;

-- Drop RLS policies (will be dropped with tables, but explicit for clarity)
DROP POLICY IF EXISTS "Employees can view own reports" ON weekly_reports;
DROP POLICY IF EXISTS "Employees can create own reports" ON weekly_reports;
DROP POLICY IF EXISTS "Employees can update own draft reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can view team reports" ON weekly_reports;
DROP POLICY IF EXISTS "Managers can review reports" ON weekly_reports;

DROP POLICY IF EXISTS "Users can view comments on reports they can access" ON weekly_report_comments;
DROP POLICY IF EXISTS "Users can add comments to accessible reports" ON weekly_report_comments;

DROP POLICY IF EXISTS "Users can view attachments on accessible reports" ON weekly_report_attachments;
DROP POLICY IF EXISTS "Users can upload attachments to own reports" ON weekly_report_attachments;

-- Drop tables (CASCADE will drop all dependent objects)
DROP TABLE IF EXISTS weekly_report_attachments CASCADE;
DROP TABLE IF EXISTS weekly_report_comments CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;

-- Note: Storage bucket 'weekly-report-attachments' should be manually deleted from Supabase dashboard if no longer needed
