# WES Academy Weekly Reports - Setup Guide

## ✅ Status: Phase 2 Frontend Complete!

**Phase 1**: Database & Backend ✅  
**Phase 2**: Frontend Components ✅  
**Phase 3**: Database Migration & Testing 🚧

---

## 📦 What's Been Built

### Backend (Phase 1)
- ✅ Complete 7-table database schema
- ✅ TypeScript types and interfaces
- ✅ Full service layer with CRUD operations
- ✅ Auto-calculation of stats
- ✅ Bulk operations (create week with all dailies)

### Frontend (Phase 2)
- ✅ **Teacher Dashboard** (`/wes-reports`)
  - List all weekly reports
  - Create new report dialog
  - Stats overview cards
  - Report cards with status badges

- ✅ **Weekly Report Form** (`/wes-reports/:reportId`)
  - Multi-tab interface (Header + 6 daily tabs + Challenges + Summary)
  - Real-time auto-save for each section
  - Status tracking (draft/submitted/approved/rejected)

- ✅ **Daily Report Sections** (for each day):
  - **15:00 Task Updates**: Attendance tracking, progress tracker
  - **16:00 Lesson Plans**: 3 LPs with submitted/reviewed/rating
  - **16:30 Parent Calls**: Called/received counter, comments
  - **16:55/17:35/18:15 Class Updates**: 3 classes with unit/chapter/outcomes
  - **Closing Checklist**: Video/Attendance/Tracker checkboxes
  - **Academic Feedback**: What's good/improvement/rating/signature
  - **Operations Feedback**: What's good/improvement/rating/signature

- ✅ **Challenge Manager**
  - Add/delete challenges
  - Track solutions applied
  - Display on summary tab

- ✅ **Summary Tab**
  - Key metrics (attendance %, LPs, parent calls, chapters)
  - Feedback ratings with progress bars
  - Daily completion status
  - Challenges summary

- ✅ **Navigation**
  - Added "WES Academy Reports" to sidebar menu
  - Routes configured in App.tsx

---

## 🚀 Next Step: Apply Database Migration

### Option 1: Via Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]
   - Navigate to: **SQL Editor** (left sidebar)

2. **Create New Query**
   - Click "+ New query"
   - Copy the entire content from: `supabase/migrations/wes_academy_weekly_reports.sql`
   - Paste into SQL Editor

3. **Run Migration**
   - Click "Run" button
   - Wait for success message
   - Check for any errors (there shouldn't be any)

4. **Verify Tables Created**
   - Navigate to: **Table Editor** (left sidebar)
   - You should see 7 new tables:
     - `wes_weekly_reports`
     - `wes_daily_reports`
     - `wes_lesson_plans`
     - `wes_class_updates`
     - `wes_academic_feedback`
     - `wes_operations_feedback`
     - `wes_challenges`

### Option 2: Via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db reset --db-url [YOUR_DATABASE_URL]
supabase db push
```

---

## 🧪 Testing the System

### Test 1: Create a New Report

1. **Login to OneDesk**
   - Navigate to: **WES Academy Reports** (sidebar)

2. **Create New Report**
   - Click "New Report" button
   - Fill in:
     - Teacher Name: Your name
     - Class/Batch: e.g., "Class 10A"
     - Week Start Date: Select a Saturday
   - Click "Create Report"

3. **Verify Auto-Creation**
   - System should create:
     - 1 weekly report
     - 6 daily reports (Sat-Fri)
     - 18 lesson plans (3 per day)
     - 18 class updates (3 per day)
   - You should be redirected to the report form

### Test 2: Fill Daily Reports

1. **Select a Day Tab** (e.g., Saturday)

2. **Fill Task Updates (15:00)**
   - My Attendance: 25
   - Total Strength: 30
   - Progress Tracker: "Updated all student progress"
   - Click "Save Task Updates"

3. **Fill Lesson Plans (16:00)**
   - LP 1: Check "Submitted", Check "Reviewed", Rating: 8
   - LP 2: Check "Submitted", Rating: 7
   - LP 3: Check "Submitted"

4. **Fill Parent Calls (16:30)**
   - Called: 5
   - Received: 3
   - Comments: "Discussed student progress with parents"
   - Click "Save Parent Calls"

5. **Fill Class Updates**
   - For each time slot (16:55, 17:35, 18:15):
     - Unit: "Unit 3"
     - Chapter: "Chapter 5"
     - Learning Outcomes: "Students learned..."
     - What Went Well: "Great participation"
     - Chapters Complete: 2
     - Summary: "Overall productive class"
     - Click "Save Class Update"

6. **Closing Checklist**
   - Check: Class Video
   - Check: Attendance
   - Check: Tracker
   - Click "Save Checklist"

7. **Incharge Feedback** (Can be filled by manager/admin)
   - Academic Feedback:
     - What Is Good: "Well prepared"
     - Where Improvement Needed: "More engagement"
     - Rating: 8
     - Signature: "John Doe"
     - Date: Today
     - Click "Save Feedback"
   - Operations Feedback: (same format)

### Test 3: Add Challenges

1. **Go to "Challenges" Tab**
2. **Add New Challenge**
   - Challenge: "Some students were absent"
   - Solution: "Arranged makeup classes"
   - Click "Add Challenge"
3. **Verify** challenge appears in list

### Test 4: View Summary

1. **Go to "Summary" Tab**
2. **Verify Auto-Calculated Stats**:
   - Attendance percentage (should be 83.3% from 25/30)
   - Lesson plans submitted (3/18 for one day)
   - Parent calls (5 called, 3 received)
   - Feedback ratings (8/10 for academic)
   - Daily completion status

### Test 5: Submit Report

1. **Click "Submit for Approval"** (bottom right)
2. **Verify**:
   - Stats are calculated
   - Status changes to "Submitted"
   - Report appears in dashboard with "Submitted" badge
   - Report is no longer editable

---

## 🔐 Row-Level Security (RLS) Policies

The migration includes RLS policies that:

✅ **Teachers can**:
- View their own reports
- Create new reports
- Update their own DRAFT reports
- Cannot update submitted/approved/rejected reports

✅ **Managers/Admins can**:
- View all reports
- Update any report (including submitted ones)
- Approve/reject reports
- Add feedback to any report

---

## 📊 Database Schema Summary

```
wes_weekly_reports (Main header)
├── teacher_id, teacher_name, class_batch
├── week_start_date, week_end_date
├── status (draft/submitted/approved/rejected)
├── Summary stats (calculated automatically)
└── Has many:
    ├── wes_daily_reports (6 days)
    │   ├── day_name, day_date
    │   ├── Attendance, progress tracker
    │   ├── Parent calls data
    │   ├── Closing checklist
    │   └── Has many:
    │       ├── wes_lesson_plans (3 per day = 18 total)
    │       │   ├── submitted, reviewed, rating
    │       ├── wes_class_updates (3 per day = 18 total)
    │       │   ├── unit, chapter, learning_outcomes
    │       │   ├── what_went_well, summary
    │       ├── wes_academic_feedback (1 per day = 6 total)
    │       │   ├── what_is_good, improvement_needed
    │       │   ├── rating (1-10), signature
    │       └── wes_operations_feedback (1 per day = 6 total)
    │           ├── what_is_good, improvement_needed
    │           ├── rating (1-10), signature
    └── wes_challenges
        ├── challenge_description
        └── solution_applied
```

---

## 🎨 UI Color Coding

- **15:00 Task Updates**: Green background
- **16:00 Lesson Plans**: Blue background
- **16:30 Parent Calls**: Yellow background
- **16:55 Class 1**: Purple background
- **17:35 Class 2**: Orange background
- **18:15 Class 3**: Pink background
- **Academic Feedback**: Blue border
- **Operations Feedback**: Orange border

---

## 📱 Mobile Responsive

- Desktop: Full layout with side-by-side sections
- Tablet: Stacked sections, horizontal tab scroll
- Mobile: Single column, dropdown day selection

---

## 🔄 Auto-Calculation Logic

When you click "Submit for Approval", the system automatically calculates:

1. **Total Attendance %** = (Sum of my_attendance) / (Sum of total_strength) × 100
2. **Total LPs Submitted** = Count of lesson plans where submitted = true
3. **Total LPs Reviewed** = Count of lesson plans where reviewed = true
4. **Average Academic Rating** = Average of all academic_feedback.rating
5. **Average Operations Rating** = Average of all operations_feedback.rating

These stats are saved to `wes_weekly_reports` table.

---

## 🚨 Important Notes

1. **Week Start Date must be Saturday** (first day of week in WES format)
2. **System auto-creates 6 days**: Saturday, Monday, Tuesday, Wednesday, Thursday, Friday
3. **Teachers cannot edit after submission** (only draft status)
4. **All sections are optional** until submit (partial save supported)
5. **Real-time auto-save** on each section (no need to save entire form)
6. **Stats calculate on submit** (not on save)

---

## 📝 Files Created

### Pages (2 files)
- `src/pages/WESTeacherReports.tsx` - Dashboard with report list
- `src/pages/WESWeeklyReportForm.tsx` - Main report form with tabs

### Components (10 files)
- `src/components/wes-reports/WESDailyReportTab.tsx` - Daily tab container
- `src/components/wes-reports/WESTaskUpdates.tsx` - 15:00 section
- `src/components/wes-reports/WESLessonPlanSection.tsx` - 16:00 section
- `src/components/wes-reports/WESParentCallTracker.tsx` - 16:30 section
- `src/components/wes-reports/WESClassUpdateForm.tsx` - Class update sections
- `src/components/wes-reports/WESClosingChecklist.tsx` - Checklist section
- `src/components/wes-reports/WESFeedbackForm.tsx` - Feedback forms
- `src/components/wes-reports/WESChallengeManager.tsx` - Challenges tab
- `src/components/wes-reports/WESSummaryTab.tsx` - Summary tab

### Routes (App.tsx)
- `/wes-reports` - Teacher dashboard
- `/wes-reports/:reportId` - Report form

### Navigation
- Added "WES Academy Reports" to sidebar menu

---

## ✅ Build Status

```
✓ 3575 modules transformed
✓ built in 34.49s
Exit Code: 0
```

**0 Errors** | **0 Warnings** (except chunk size - not critical)

---

## 🎯 What's Next

1. **Apply Database Migration** (see instructions above)
2. **Test Report Creation** (create first report via UI)
3. **Fill Sample Data** (test all sections)
4. **Submit Report** (verify stats calculation)
5. **Check Dashboard** (verify report appears with correct status)

---

## 🐛 Troubleshooting

### Issue: Tables not found
**Solution**: Make sure you ran the migration in Supabase SQL Editor

### Issue: Permission denied
**Solution**: Check RLS policies are enabled. You must be logged in as a user with role in `user_roles` table

### Issue: Stats not calculating
**Solution**: Stats only calculate when you click "Submit for Approval", not on individual saves

### Issue: Cannot edit after submission
**Solution**: This is by design. Only DRAFT reports can be edited by teachers. Managers/Admins can edit any status.

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify database migration ran successfully
4. Ensure user has proper role in `user_roles` table

---

**Last Updated**: June 17, 2026  
**Version**: 1.0.0  
**Status**: Ready for Database Migration ✅
