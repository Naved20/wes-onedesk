# WES OneDesk - UI Design Documentation

## Project Overview

**WES OneDesk** is an integrated HR management system for the World Education Services built with React + TypeScript and Supabase backend.

---

## 1. Design System

### Color Palette
```
Primary: #F59E0B (Amber/Orange) - CTA buttons, highlights
Secondary: #3B82F6 (Blue) - Information, secondary actions
Success: #10B981 (Green) - Approved, completed, active states
Warning: #EF4444 (Red) - Rejected, urgent, errors
Neutral: #6B7280 (Gray) - Text, borders, disabled states
Background: #FFFFFF (White) - Main surface
Dark Background: #1F2937 (Dark Gray) - Alternates, dark mode
```

### Typography
```
Headings: Font-weight 600-700, sizes 24px-32px
Body: Font-weight 400, size 14-16px
Labels: Font-weight 500, size 12-14px
Monospace: For codes, IDs, technical content
```

### Components Library
**shadcn/ui** - Pre-built, accessible React components:
- Button, Dialog, Card, Table, Badge, Tabs
- Forms, Input, Select, DatePicker
- Alert, Toast, DropdownMenu

---

## 2. App Architecture

### Main Layout
```
┌─────────────────────────────────────────┐
│           Header (Navigation)           │
├──────────────┬──────────────────────────┤
│              │                          │
│   Sidebar    │    Main Content Area     │
│   (Routes)   │                          │
│              │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

### Route Structure
```
/dashboard          - Employee/Admin dashboard
/leaves             - Leave management & approvals
/attendance         - Attendance & check-ins
/salary             - Salary slips & payroll
/tasks              - Task management
/performance        - Appraisals & reviews
/reports            - Weekly/monthly reports
/admin              - Admin panel (settings, configurations)
/face-hub           - Face recognition check-in
```

---

## 3. Key Screens & Components

### 3.1 Dashboard Screen

**Route:** `/dashboard`

**Layout:**
```
┌─ Leave Balance Cards ─────────────────┐
│ ┌─────────┬─────────┬─────────┐       │
│ │ Casual  │ Medical │ Sick    │  ...  │
│ │ 2/6 rem │ 0/5 rem │ 0/2 rem │       │
│ └─────────┴─────────┴─────────┘       │
└───────────────────────────────────────┘

┌─ Quick Links ─────────────────────────┐
│ [Apply Leave]  [Check-in]  [My Tasks] │
└───────────────────────────────────────┘

┌─ Widgets (Side by side) ──────────────┐
│ ┌─ Attendance ─┐  ┌─ Salary Status ─┐ │
│ │ 85% present  │  │ Pending: ₹50K   │ │
│ └──────────────┘  └─────────────────┘ │
└───────────────────────────────────────┘

┌─ Leaderboard ──────────────────────────┐
│ 1. John - 95% attendance, 4.5 rating   │
│ 2. Jane - 92% attendance, 4.2 rating   │
│ 3. Mike - 88% attendance, 4.0 rating   │
└───────────────────────────────────────┘
```

**Components:**
- `LeaveBalanceCard` - Shows remaining leaves per type
- `QuickLinks` - Fast access buttons
- `AttendanceStats` - Attendance summary
- `SalaryStatusWidget` - Pending salary info
- `Leaderboard` - Performance rankings

---

### 3.2 Leaves Management Screen

**Route:** `/leaves`

**Sub-sections:**
1. **Leave Balance View**
   - Table showing: Leave Type, Allocated, Used, Remaining
   - Color coding: Green (sufficient), Yellow (low), Red (none)
   - Manual adjust button (admin only)

2. **Apply for Leave**
   - Modal/Dialog form:
     ```
     Leave Type: [Dropdown] - casual/medical/emergency/sick/lop/half_day
     Start Date: [DatePicker]
     End Date: [DatePicker]
     Is Half Day: [Checkbox]
     Reason: [TextArea]
     [Cancel] [Submit]
     ```

3. **Leave Requests List**
   - Table columns: Date Range, Type, Days, Status, Action
   - Status badges: Pending (yellow), Approved (green), Rejected (red)
   - Employee view: Own requests only
   - Manager view: Team requests to approve/reject
   - Admin view: All requests with full controls

**Components:**
- `LeaveApplicationForm` - Apply for leave
- `LeaveApprovalDialog` - Approve/reject leaves
- `BulkLeaveApproval` - Batch approval (manager)
- `LeaveBalanceCard` - Balance display
- `LeaveAnalytics` - Charts & trends

---

### 3.3 Attendance Screen

**Route:** `/attendance`

**Sub-sections:**
1. **Check-in Interface**
   - Current time display
   - [Check In] button (green when available)
   - Today's check-ins: Entry time, Exit time
   - Shift info: Expected arrival, break times

2. **Attendance Approval**
   - Table: Employee, Date, Status, Request Reason
   - Actions: [Approve] [Reject] with comment field
   - Bulk approval checkbox for multiple rows

3. **Attendance History**
   - Calendar view OR Table view
   - Columns: Date, Entry, Exit, Duration, Status
   - Color: Green (present), Red (absent), Yellow (late), Gray (holiday)

**Components:**
- `AttendanceCheckIn` - Check-in form
- `AttendanceApprovalDialog` - Approval interface
- `BulkAttendanceApproval` - Batch actions
- `AttendanceStats` - Summary widget
- `HolidayManager` - Holiday configuration

---

### 3.4 Salary Screen

**Route:** `/salary`

**Sub-sections:**
1. **Salary Overview**
   - Current month: Gross, Deductions, Net
   - Previous months dropdown

2. **Payslip View**
   - Header: WES letterhead, Employee info
   - Earnings: Basic, HRA, Allowances breakdown
   - Deductions: PF, Tax, Other deductions
   - Net Salary
   - Footer: Authorized signature

3. **Salary History**
   - Table: Month, Gross, Deductions, Net
   - [Download PDF] button per row

**Components:**
- `PayslipView` - Payslip display
- `PayslipPDF` - PDF generation
- `EmployeeSalaryView` - Monthly summary
- `EmployeeSalaryDetails` - Detailed breakdown

---

### 3.5 Tasks Screen

**Route:** `/tasks`

**Sub-sections:**
1. **Task List**
   - Cards/Table: Title, Description, Due Date, Priority, Status
   - Color priority: Red (urgent), Orange (high), Yellow (medium), Gray (low)
   - Status badges: Pending (yellow), In Progress (blue), Completed (green), Cancelled (gray)
   - Filters: By status, priority, assignee
   - Sort: By due date, priority, created date

2. **Task Detail**
   - Title, Description, Assigned to, Due date
   - Status selector (employee can mark complete)
   - Comments section with threaded replies
   - Attachment support

3. **Task Creation** (Manager/Admin)
   - Form: Title, Description, Assign to (dropdown), Due date, Priority
   - [Create Task] button

**Components:**
- Task card with status & priority indicators
- Task detail modal with comments
- Task creation form
- Task filter/sort controls

---

### 3.6 Admin Panel

**Route:** `/admin`

**Sub-sections:**
1. **Leave Configuration**
   - Leave types: casual, medical, emergency, sick, lop, half_day
   - Per type settings: Max days/request, max/week, max/month, advance notice
   - Allocation rules: Who gets how many days
   - Reset schedule configuration

2. **Attendance Rules**
   - Shift timings: Start, end, break duration
   - Check-in grace period
   - Holiday management: Add/edit holidays

3. **Employee Management**
   - Table: Employee list with filters
   - Columns: ID, Name, Department, Role, Status
   - Actions: Edit, Disable, View details, Reset password

4. **Salary Configuration**
   - Earning types: Basic, HRA, bonus, incentive, etc.
   - Deduction types: PF, Tax, advance, etc.
   - Salary structure templates

5. **Reports & Analytics**
   - Attendance dashboard: Trends, absenteeism
   - Leave trends: Usage by type
   - Salary reports: Monthly, quarterly, yearly

**Components:**
- Configuration forms for each module
- Data tables with bulk actions
- Analytics charts & graphs

---

### 3.7 Performance/Appraisal Screen

**Route:** `/performance`

**Sub-sections:**
1. **My Appraisals**
   - List of appraisals with cycle info
   - Status: Pending, In Review, Completed
   - [View/Edit] button per appraisal

2. **Appraisal Form**
   - Rating sections: Skills, Performance, Conduct
   - 5-star rating system
   - Comments field
   - Self-assessment vs Manager assessment

3. **Leaderboard**
   - Rankings by rating, performance
   - Department comparison

**Components:**
- `AppraisalManager` - Appraisal CRUD
- Performance widgets

---

### 3.8 Reports Screen

**Route:** `/reports`

**Sub-sections:**
1. **Weekly Reports**
   - Sections: Tasks, Goals, Achievements, Challenges
   - Submit button (due every Friday)

2. **Admin Report View**
   - Employee reports table with filters
   - [View Report] modal per employee

**Components:**
- Report submission form
- Report view/export

---

## 4. Common Components & Patterns

### Buttons
```
Primary: [Apply Leave] - Amber background, white text
Secondary: [Cancel] - Gray background
Danger: [Delete] - Red background
Success: [Approve] - Green background
```

### Status Indicators
```
Pending: Yellow badge with icon
Approved: Green checkmark badge
Rejected: Red X badge
In Progress: Blue circle badge
Completed: Green checkmark with green background
```

### Forms
```
Pattern:
  Label (12px, bold)
  Input/Select/DatePicker (14px, gray border)
  Helper text or error message (11px, red if error)
  [Submit] [Cancel] buttons at bottom
```

### Tables
```
Pattern:
  Header row: Gray background, sortable columns
  Data rows: Alternating white/light-gray
  Actions column: [Edit] [Delete] [View] buttons
  Pagination: Bottom right
  Checkboxes: For bulk actions
```

### Modals/Dialogs
```
Pattern:
  X button to close (top right)
  Title
  Content
  Footer: [Cancel] [Action]
  Semi-transparent backdrop
```

---

## 5. Responsive Design

### Breakpoints
```
Mobile: < 640px
  - Single column layout
  - Sidebar collapses to hamburger menu
  - Cards stack vertically

Tablet: 640px - 1024px
  - 2 column layout where applicable
  - Sidebar visible but narrow

Desktop: > 1024px
  - Full layout
  - Sidebar permanent
  - Multi-column grids
```

### Mobile Optimizations
```
- Touch-friendly button sizes: 44x44px minimum
- Simplified forms: One field per screen if possible
- Bottom sheet for navigation instead of sidebar
- Simplified tables: Horizontal scroll or stacked layout
```

---

## 6. Color Usage by Feature

### Leave Management
```
Casual Leave: #3B82F6 (Blue)
Medical Leave: #10B981 (Green)
Emergency Leave: #EF4444 (Red)
Sick Leave: #F59E0B (Orange)
LOP: #8B5CF6 (Purple)
Half Day: #6B7280 (Gray)
```

### Attendance
```
Present: #10B981 (Green)
Absent: #EF4444 (Red)
Late: #F59E0B (Orange)
On Leave: #3B82F6 (Blue)
Holiday: #6B7280 (Gray)
```

### Salary
```
Gross Salary: #10B981 (Green)
Deductions: #EF4444 (Red)
Net Salary: #3B82F6 (Blue)
Pending: #F59E0B (Orange)
```

---

## 7. Accessibility

### Guidelines
- **Color contrast**: WCAG AA minimum 4.5:1 for text
- **Focus states**: Visible focus ring on all interactive elements
- **Keyboard navigation**: Tab through all elements
- **Alt text**: Images have descriptive alt text
- **ARIA labels**: For screen readers on complex components
- **Error messages**: Clear, specific, and associated with form fields

### Testing
- Manual testing with screen readers (NVDA, JAWS)
- Keyboard-only navigation
- Color contrast checking tools

---

## 8. Animations & Transitions

### Page Transitions
```
Fade in: 300ms ease-out
Slide from right: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Component Animations
```
Button hover: Background color change 200ms
Dropdown open: Scale from center + fade 200ms
Toast notification: Slide in from bottom 300ms
Loading spinner: Continuous rotation
```

---

## 9. File Structure

```
src/
├── components/
│   ├── attendance/
│   │   ├── AttendanceCheckIn.tsx
│   │   ├── AttendanceApprovalDialog.tsx
│   │   ├── AttendanceStats.tsx
│   │   ├── BulkAttendanceApproval.tsx
│   │   └── HolidayManager.tsx
│   ├── dashboard/
│   │   ├── Leaderboard.tsx
│   │   ├── QuickLinks.tsx
│   │   └── SalaryStatusWidget.tsx
│   ├── leaves/
│   │   ├── LeaveApplicationForm.tsx
│   │   ├── LeaveApprovalDialog.tsx
│   │   ├── BulkLeaveApproval.tsx
│   │   ├── LeaveBalanceCard.tsx
│   │   └── LeaveAnalytics.tsx
│   ├── salary/
│   │   ├── PayslipView.tsx
│   │   ├── PayslipPDF.tsx
│   │   ├── EmployeeSalaryView.tsx
│   │   └── EmployeeSalaryDetails.tsx
│   ├── performance/
│   │   └── AppraisalManager.tsx
│   ├── reports/
│   │   ├── UploadReportDialog.tsx
│   │   └── AdminUploadedReportView.tsx
│   ├── tasks/
│   │   └── TaskManager.tsx
│   ├── layout/
│   │   └── DashboardLayout.tsx
│   ├── NavLink.tsx
│   ├── NotificationBell.tsx
│   ├── ProtectedRoute.tsx
│   └── GoogleDriveManager.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Leaves.tsx
│   ├── Attendance.tsx
│   ├── Salary.tsx
│   ├── Tasks.tsx
│   ├── Performance.tsx
│   ├── Reports.tsx
│   ├── Admin.tsx
│   └── Login.tsx
├── styles/
│   └── App.css
└── App.tsx
```

---

## 10. Development Notes

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **State Management**: React hooks + Context API
- **Real-time**: Supabase subscriptions
- **Build**: Vite

### Key Dependencies
```json
{
  "react": "^18.x",
  "typescript": "^5.x",
  "@radix-ui/*": "Latest",
  "tailwindcss": "^3.x",
  "@supabase/supabase-js": "Latest",
  "react-router-dom": "^6.x"
}
```

### Coding Standards
- Use functional components with hooks
- Prop drilling minimized with Context API
- Type all props with TypeScript interfaces
- Separate concerns: Components vs. Logic
- Use shadcn/ui components as building blocks

---

## 11. Future Enhancements

- [ ] Dark mode toggle
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Workflow automation (leave approvals, reminders)
- [ ] Email integrations
- [ ] Compliance reports (audit trails)
- [ ] Multi-language support
- [ ] Advanced search/filters
- [ ] Export to Excel/PDF (batch)
- [ ] Calendar integrations (Google Calendar sync)

---

**Last Updated:** August 8, 2026
**Maintained By:** WES Tech Team
