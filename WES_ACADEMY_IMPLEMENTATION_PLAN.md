# WES Academy Weekly Reports - Full Implementation Plan

## 📋 Overview
Complete teacher weekly reporting system based on WES Academy format with:
- Daily detailed tracking (6 days: Saturday-Friday)
- Lesson plan management (3 per day)
- Parent call tracking
- Multi-class updates (3 classes per day)
- Dual feedback system (Academic + Operations Incharge)
- Challenges & solutions tracking

---

## ✅ Phase 1: Database & Backend (COMPLETED)

### Created Files:
1. **Database Schema** (`supabase/migrations/wes_academy_weekly_reports.sql`)
   - `wes_weekly_reports` - Main report header
   - `wes_daily_reports` - Daily entries (6 days)
   - `wes_lesson_plans` - 3 lesson plans per day
   - `wes_class_updates` - 3 class slots per day
   - `wes_academic_feedback` - Academic Incharge daily feedback
   - `wes_operations_feedback` - Operations Incharge daily feedback
   - `wes_challenges` - Challenges & solutions

2. **TypeScript Types** (`src/types/wesWeeklyReport.ts`)
   - All interfaces for tables
   - DTOs for create/update operations
   - Complete report types with nested data
   - Stats types for dashboard

3. **Services** (`src/services/wesWeeklyReportService.ts`)
   - CRUD operations for all tables
   - Stats calculation methods
   - Bulk operations (create week with all daily reports)
   - Auto-calculation of summary stats

---

## 🎯 Phase 2: Frontend Components (TODO)

### Components to Build:

#### 1. **Teacher Dashboard** (`src/pages/WESTeacherReports.tsx`)
- List of all weekly reports
- Create new report button
- Stats overview cards
- Filter by status/date

#### 2. **Weekly Report Form** (`src/components/wes-reports/WESWeeklyReportForm.tsx`)
**Tabs Structure:**
- **Header Tab** - Teacher name, class/batch, week dates
- **Daily Tabs** (6 tabs: Sat-Fri):
  - Task Updates section (15:00)
  - Lesson Plans section (16:00) - 3 LPs
  - Parent Calls section (16:30)
  - Class Updates sections (16:55, 17:35, 18:15) - 3 classes
  - Closing Checklist
  - Academic Feedback
  - Operations Feedback
- **Challenges Tab** - Add/edit challenges & solutions
- **Summary Tab** - Auto-calculated stats

#### 3. **Daily Report Card** (`src/components/wes-reports/WESDailyReportCard.tsx`)
Collapsible card showing:
- Day name & date
- Attendance stats
- Lesson plans status (submitted/reviewed count)
- Parent calls summary
- Closing checklist status
- Feedback ratings

#### 4. **Lesson Plan Manager** (`src/components/wes-reports/WESLessonPlanSection.tsx`)
3 lesson plan entries with:
- Submitted checkbox
- Reviewed checkbox
- Approval rating (1-10) dropdown

#### 5. **Class Update Form** (`src/components/wes-reports/WESClassUpdateForm.tsx`)
For each class slot:
- Unit name input
- Chapter name input
- Learning outcomes textarea
- What went well textarea
- Chapters/topics completed counter
- Summary textarea

#### 6. **Parent Call Tracker** (`src/components/wes-reports/WESParentCallTracker.tsx`)
- Called counter
- Received counter
- Comments textarea

#### 7. **Feedback Forms** (`src/components/wes-reports/WESFeedbackForm.tsx`)
Two variants (Academic & Operations):
- What is good textarea
- Where improvement needed textarea
- Rating selector (1-10)
- Signature input
- Date picker

#### 8. **Challenge Manager** (`src/components/wes-reports/WESChallengeManager.tsx`)
List of challenges with:
- Add new challenge button
- Challenge description
- Solution applied
- Delete button

#### 9. **Manager Dashboard** (`src/pages/WESManagerReports.tsx`)
- View all teacher reports
- Filter by teacher/status/date
- Approve/reject reports
- View detailed analytics

---

## 📊 Phase 3: UI/UX Design

### Layout Structure:
```
┌─────────────────────────────────────────┐
│ Header: WES ACADEMY                     │
│ Teacher: [Name] | Class: [Batch]       │
│ Week: [Start] to [End]                 │
├─────────────────────────────────────────┤
│ [Header] [Sat] [Mon] [Tue] [Wed] [Thu] │
│ [Fri] [Challenges] [Summary]           │
├─────────────────────────────────────────┤
│                                         │
│ Daily Content based on selected tab:    │
│                                         │
│ 15:00 - Task Updates                    │
│ ┌───────────────────────────────┐      │
│ │ My Attendance: [__]            │      │
│ │ Total Strength: [__]           │      │
│ │ Progress Tracker: [______]     │      │
│ └───────────────────────────────┘      │
│                                         │
│ 16:00 - Lesson Plans                    │
│ ┌─ LP 1 ─────────────────┐             │
│ │ ☐ Submitted ☐ Reviewed  │             │
│ │ Rating: [1-10▼]         │             │
│ └─────────────────────────┘             │
│ [LP 2] [LP 3] ...                       │
│                                         │
│ 16:30 - Parent Calls                    │
│ [Called: __] [Received: __]             │
│ [Comments: __________]                  │
│                                         │
│ 16:55 / 17:35 / 18:15 - Class Updates  │
│ [3 Class Update Forms]                  │
│                                         │
│ Closing Checklist                       │
│ ☐ Class Video ☐ Attendance ☐ Tracker   │
│                                         │
│ Incharge Feedback                       │
│ [Academic] [Operations]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### Creating a New Report:
1. Teacher clicks "New Report"
2. Enters: Name, Class/Batch, Week Start Date
3. System creates:
   - 1 weekly report
   - 6 daily reports (Sat-Fri)
   - 18 lesson plans (3 per day × 6 days)
   - 18 class updates (3 per day × 6 days)
4. Teacher fills data day by day
5. Submits for approval
6. System auto-calculates stats

### Manager Review:
1. Manager views submitted reports
2. Reviews daily entries
3. Can add feedback
4. Approves or rejects

---

## 🎨 Styling Guidelines

### Colors:
- **Header**: Blue gradient
- **Tabs**: Gray with blue active
- **Sections**: Light gray backgrounds
- **Time Slots**: Color-coded badges
  - 15:00 - Green
  - 16:00 - Blue
  - 16:30 - Yellow
  - 16:55/17:35/18:15 - Purple/Orange/Pink
- **Feedback**: 
  - Academic - Blue border
  - Operations - Orange border

### Components:
- Use **shadcn/ui** components
- **Tabs** for navigation
- **Cards** for sections
- **Collapsible** for daily reports
- **Progress** indicators for completion
- **Badges** for status
- **Forms** with validation (Zod)

---

## 📱 Responsive Design

### Desktop (>1024px):
- Full width layout
- Side-by-side class updates
- Visible all tabs

### Tablet (768-1024px):
- Stacked class updates
- Horizontal scroll for tabs

### Mobile (<768px):
- Single column
- Dropdown for day selection
- Accordion for sections

---

## 🔐 Security & Permissions

### Row-Level Security:
- Teachers: View/edit own reports (draft only)
- Managers: View all, edit any
- Admins: Full access

### Validation Rules:
- Week dates must be Monday-Sunday
- Lesson plan ratings: 1-10
- Feedback ratings: 1-10
- Parent call counts >= 0
- Attendance percentage: 0-100%

---

## 📈 Implementation Timeline

### Week 1: Core Components
- [ ] Teacher dashboard page
- [ ] Weekly report form shell
- [ ] Daily report tabs
- [ ] Task updates section

### Week 2: Daily Sections
- [ ] Lesson plan manager (3 LPs)
- [ ] Parent call tracker
- [ ] Class update forms (3 classes)
- [ ] Closing checklist

### Week 3: Feedback & Summary
- [ ] Academic feedback form
- [ ] Operations feedback form
- [ ] Challenge manager
- [ ] Summary tab with stats

### Week 4: Manager View & Testing
- [ ] Manager dashboard
- [ ] Approval workflow
- [ ] Analytics dashboard
- [ ] Full testing & bug fixes

---

## 🚀 Next Steps

1. **Apply Database Migration**:
   ```sql
   -- Run in Supabase SQL Editor
   -- File: supabase/migrations/wes_academy_weekly_reports.sql
   ```

2. **Test Services**:
   ```typescript
   // Test create week with daily reports
   const reportId = await wesWeeklyReportService.createWeekWithDailyReports(
     userId,
     "John Doe",
     "Class 10A",
     "2026-06-16" // Monday
   );
   ```

3. **Build First Component**: Teacher Dashboard

4. **Iterate** day-by-day sections

---

## 📝 Notes

- All lesson plans/feedback are **optional** until submitted
- Stats auto-calculate on submit
- Teachers can save draft anytime
- Managers see real-time updates
- Mobile-first design approach

---

**Status**: Phase 1 Complete ✅ | Phase 2 Starting 🚧  
**Last Updated**: June 17, 2026  
**Next**: Build Teacher Dashboard UI
