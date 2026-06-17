# WES Academy Weekly Reports - Migration Guide

## Overview
The simple weekly reports system has been completely removed and replaced with the comprehensive WES Academy format for teacher weekly reports.

## Changes Made

### ✅ **Completed Cleanup**
1. **App.tsx Updated**: Removed all old weekly report imports and routes
   - Removed imports: `WeeklyReportEmployee`, `WeeklyReportManager`, `WeeklyReportAdmin`
   - Removed routes: `/weekly-report`, `/weekly-report-manager`, `/weekly-report-admin`
   - Kept WES routes: `/wes-reports`, `/wes-reports/:reportId`

2. **Files Deleted**:
   - `WEEKLY_REPORTS_SETUP.md` - Old setup guide
   - `supabase/migrations/create_weekly_reports_table.sql` - Old database schema

### ✅ **WES Academy Files Created**:
1. **New Database Schema**: `supabase/migrations/wes_academy_weekly_reports.sql`
   - 7 tables for comprehensive teacher reporting
   - Complete RLS policies for security

2. **Backend Ready**:
   - `src/types/wesWeeklyReport.ts` - TypeScript types
   - `src/services/wesWeeklyReportService.ts` - CRUD operations

3. **Frontend Started**:
   - `src/pages/WESTeacherReports.tsx` - Teacher dashboard page
   - `src/pages/WESWeeklyReportForm.tsx` - Main form shell
   - `src/components/wes-reports/` - Component shell files

## Next Steps to Complete Migration

### **Phase 1: Database Migration** (Run in Supabase SQL Editor)

#### Step 1: Drop Old Tables (if they exist)
```sql
-- Copy and run the contents of:
-- supabase/migrations/drop_old_weekly_reports.sql
```

#### Step 2: Apply New Schema
```sql
-- Copy and run the contents of:
-- supabase/migrations/wes_academy_weekly_reports.sql
```

### **Phase 2: Build Frontend Components**

1. **Teacher Dashboard** (`src/pages/WESTeacherReports.tsx`) - IN PROGRESS
   - List all weekly reports (draft, submitted, approved)
   - Create new report button
   - Stats overview cards

2. **Main Form** (`src/pages/WESWeeklyReportForm.tsx`) - IN PROGRESS
   - Tabs for Header + 6 Days + Challenges + Summary
   - Each day has 5 time slots
   - Auto-save draft functionality

3. **Daily Components** (`src/components/wes-reports/`) - TO BUILD
   - `WESLessonPlanSection.tsx` - 3 lesson plans per day
   - `WESParentCallTracker.tsx` - Called/received tracking
   - `WESClassUpdateForm.tsx` - 3 classes per day (16:55, 17:35, 18:15)
   - `WESFeedbackForm.tsx` - Academic & Operations feedback
   - `WESChallengeManager.tsx` - Challenges & solutions

### **Phase 3: Manager Dashboard**
- `src/pages/WESManagerReports.tsx` - Manager approval view
- Filter by teacher/status/date
- Approve/reject functionality
- Analytics dashboard

## Testing Checklist

### Database Migration
- [ ] Run `drop_old_weekly_reports.sql` in Supabase SQL Editor
- [ ] Run `wes_academy_weekly_reports.sql` in Supabase SQL Editor
- [ ] Verify 7 tables created with correct columns
- [ ] Verify RLS policies applied

### Frontend Testing
- [ ] Navigate to `/wes-reports` - should load without errors
- [ ] Create new weekly report - should create 6 daily entries
- [ ] Fill lesson plans (3 per day) - should save correctly
- [ ] Fill parent calls - should track called/received
- [ ] Fill class updates (3 per day) - should save unit/chapter info
- [ ] Submit report - should change status to "submitted"
- [ ] Manager review - should see pending reports
- [ ] Approve report - should change status to "approved"

## Error Handling

### If you see 404 errors for old weekly report pages:
- Clear browser cache
- Restart development server
- The errors should be resolved after App.tsx update

### If database migration fails:
1. Check if `weekly_reports` table exists:
   ```sql
   SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weekly_reports');
   ```
2. Drop manually:
   ```sql
   DROP VIEW IF EXISTS manager_weekly_reports_view CASCADE;
   DROP TABLE IF EXISTS weekly_report_attachments CASCADE;
   DROP TABLE IF EXISTS weekly_report_comments CASCADE;
   DROP TABLE IF EXISTS weekly_reports CASCADE;
   ```

## Benefits of New System

### WES Academy Format vs Simple Reports:
1. **Detailed Daily Tracking** (6 days: Sat-Fri vs 1 week summary)
2. **Lesson Plan Management** (3 per day vs none)
3. **Parent Call Tracking** (called/received counts vs none)
4. **Multi-Class Updates** (3 classes per day vs none)
5. **Dual Feedback System** (Academic + Operations vs single manager feedback)
6. **Challenges Tracking** (structured problem-solving vs general notes)

## Quick Start for Developers

1. **Database**: Apply both SQL scripts in order
2. **Types**: Check `src/types/wesWeeklyReport.ts` for data structures
3. **Services**: Use `wesWeeklyReportService` for all CRUD operations
4. **Components**: Follow existing patterns in leaves/performance modules

## Support
- Check existing WES components for implementation patterns
- Refer to `WES_ACADEMY_IMPLEMENTATION_PLAN.md` for detailed roadmap
- Use shadcn/ui components for consistent styling

---
**Status**: Cleanup Complete ✅ | Database Migration Pending ⏳ | Frontend Development Ongoing 🚧  
**Updated**: June 17, 2026