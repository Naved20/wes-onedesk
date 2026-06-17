# WES Academy Weekly Reports - Quick Start Guide

## 🚀 Getting Started

### Step 1: Apply Database Migration
```sql
-- Copy-paste the entire migration file into Supabase SQL Editor:
-- File: supabase/migrations/wes_academy_weekly_reports.sql
-- This creates 7 tables with RLS policies
```

### Step 2: Access the Application
- **URL**: `http://localhost:5173/wes-reports` (when running locally)
- **Auth Required**: Yes (protected route)
- **User Role**: Teacher (to create and edit reports)

### Step 3: Create a Test Report
1. Click "New Report" button (top right)
2. Fill the dialog:
   - **Teacher Name**: Your name or test name
   - **Class/Batch**: e.g., "Class 10A" or "Batch 2026"
   - **Week Start Date**: Saturday date (e.g., June 15, 2026)
3. Click "Create Report"
4. System automatically creates:
   - 1 weekly report
   - 6 daily reports (Sat-Fri)
   - 18 lesson plans (3 per day)
   - 18 class updates (3 per day)

### Step 4: Fill Daily Report
1. Click on created report from dashboard
2. You'll see tabs: Sat | Mon | Tue | Wed | Thu | Fri | Challenges | Summary
3. Start with Saturday tab:
   - Fill **Task Updates** (15:00): attendance numbers
   - Fill **Lesson Plans** (16:00): check submitted/reviewed, set rating
   - Fill **Parent Calls** (16:30): number called/received
   - Fill each **Class Update** (16:55, 17:35, 18:15): unit, chapter, learning outcomes
   - Check **Closing Checklist**: class video, attendance, tracker
   - Fill **Academic Feedback**: what's good, improvement, rating, signature
   - Fill **Operations Feedback**: same as above
4. Click "Save" buttons after each section
5. Repeat for remaining days (Mon-Fri)

### Step 5: Add Challenges (Optional)
1. Click "Challenges" tab
2. Click "Add New Challenge"
3. Enter challenge description and solution
4. Click "Add Challenge"

### Step 6: View Summary
1. Click "Summary" tab
2. See auto-calculated stats:
   - Attendance percentage
   - Lesson plans submitted/reviewed
   - Parent calls total
   - Chapters completed
   - Feedback ratings averages
   - Daily completion status

### Step 7: Submit Report
1. Click "Submit for Approval" button
2. Confirm action
3. Report status changes to "submitted"
4. Form becomes read-only

---

## 📋 Time Slots & Sections

Each day has these sections:

| Time | Section | What to Fill |
|------|---------|-------------|
| 15:00 | Task Updates | My attendance, total strength, progress tracker |
| 16:00 | Lesson Plans | 3 LPs - submitted, reviewed, rating (1-10) |
| 16:30 | Parent Calls | Called count, received count, comments |
| 16:55 | Class 1 Update | Unit, chapter, learning outcomes, what went well |
| 17:35 | Class 2 Update | Unit, chapter, learning outcomes, what went well |
| 18:15 | Class 3 Update | Unit, chapter, learning outcomes, what went well |
| - | Closing Checklist | Class video ✓, attendance ✓, tracker ✓ |
| - | Academic Feedback | What's good, improvement needed, rating (1-10) |
| - | Operations Feedback | What's good, improvement needed, rating (1-10) |

---

## 📊 Auto-Calculated Fields

These fields **automatically calculate** when you submit:

- **Attendance %** = My Attendance / Total Strength × 100
- **Total Lesson Plans Submitted** = Count of LPs with submitted=true
- **Total Lesson Plans Reviewed** = Count of LPs with reviewed=true
- **Average Academic Rating** = Average of all daily academic ratings
- **Average Operations Rating** = Average of all daily operations ratings
- **Total Chapters Complete** = Sum of all class update chapters completed
- **Days Filled** = Count of days with any data

---

## 🔍 Testing Scenarios

### Test Scenario 1: Basic Report Creation
1. Create new report for week starting June 15, 2026
2. Verify 6 days created (Sat-Fri)
3. Fill each day's task updates only
4. Submit
5. Verify attendance % calculates correctly

### Test Scenario 2: Complete Daily Entry
1. Fill all fields for Saturday:
   - Task Updates: attendance=25, strength=30
   - 3 Lesson Plans: all submitted and reviewed with ratings
   - Parent Calls: called=5, received=3
   - All 3 class updates: full details
   - Closing checklist: all checked
   - Both feedbacks: ratings 8 and 7
2. Save each section
3. Go to Summary tab
4. Verify all stats in metrics cards

### Test Scenario 3: Challenges Workflow
1. Add challenge: "Student attendance low"
2. Add solution: "Parent meeting scheduled"
3. Delete challenge with confirmation
4. Add another challenge
5. Submit report
6. Verify challenges in summary

### Test Scenario 4: Submit & Approval
1. Fill all days
2. Click "Submit for Approval"
3. Verify status badge changes to "Submitted"
4. Try editing - should be disabled
5. Try clicking save button - should be invisible

---

## 🛠️ Troubleshooting

### Issue: "Report not found"
- Verify report ID in URL is correct
- Check Supabase connection is active
- Refresh page

### Issue: "Failed to update"
- Check your internet connection
- Verify you're logged in
- Check browser console for error details
- Verify Supabase RLS policies allow your user

### Issue: Date shows "Invalid Date"
- This is handled gracefully and shows "N/A"
- Report should still save
- Try refreshing page

### Issue: Stats don't calculate
- Click "Submit for Approval"
- Stats auto-calculate during submission
- Check Summary tab after submit

### Issue: Save button disabled
- Report must be in "draft" status to edit
- Once submitted, becomes read-only
- Ask admin to reset if needed

---

## 💾 Data Saving

- **Auto-save**: NOT implemented (click Save button explicitly)
- **Each section saves independently**: Fill task updates, click Save. Then fill LPs, click Save.
- **No unsaved changes warning**: Be careful when leaving without saving
- **Draft preservation**: Can refresh page and continue editing draft reports

---

## 📱 Mobile Usage

- **Responsive design**: Works on mobile/tablet
- **Tab navigation**: Might be horizontal scroll on mobile
- **Buttons**: Large touch targets
- **Forms**: Single column on mobile

---

## 🔐 Permissions

- **Teachers**: Can create/edit own reports (draft only)
- **Managers**: Can view all reports, approve/reject
- **Admins**: Full access to all reports

If you don't see /wes-reports page:
- You might not be a teacher
- Ask admin to grant access
- Check user role in database

---

## 📞 Support

If something doesn't work:
1. Check browser console (F12 → Console tab)
2. Look for red error messages
3. Check Supabase logs
4. Try refreshing page
5. Check you're logged in

---

## 🎯 What's Next

After basic testing:
1. Create manager dashboard view
2. Add email notifications
3. Export reports to PDF
4. Add file attachments
5. Add comment threads
6. Mobile native app
7. Advanced analytics

---

**Happy reporting!** 📝

