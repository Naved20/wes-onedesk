# Task-Specific Individual Peer Reviewer Feature

## ✅ Implementation Complete!

Aapke peer review system mein ab **task-specific individual 1:1 reviewer assignment** feature add ho gaya hai. Har task ke liye alag-alag reviewer assignments ho sakti hain.

## 🎯 Key Features

### 1. **Three Review Assignment Types**
Task create karte waqt admin teen options mein se choose kar sakta hai:

#### **Group-based** (Existing System)
- Reviewer groups aur individual selections use karein
- Sabhi assigned users ke liye same reviewers
- Example: Marketing Team group ko assign karo

#### **Individual 1:1** (NEW!)
- Har user ke liye specific reviewer manually select karein
- Maximum flexibility
- Example:
  - User A → Reviewer B
  - User C → Reviewer D
  - User E → Reviewer F

#### **Mixed** (Best of Both!)
- Group-based + Individual assignments dono use karein
- Example: Marketing Team group + specific reviewers for some users

### 2. **User-Wise Reviewer Selection**
- Task create karte waqt har assigned user ke liye reviewer select kar sakte hain
- Dropdown se easily select karein
- Real-time preview of assignments
- "No reviewer" option bhi available

### 3. **Task-Specific Assignments**
- Har task ke liye different reviewer assignments
- Task 1: User A → Reviewer B
- Task 2: User A → Reviewer C
- Complete flexibility!

## 📊 Database Structure

### Table: `individual_peer_reviewers`
```sql
- id: UUID (Primary Key)
- task_id: UUID (Foreign Key to tasks) ← TASK-SPECIFIC!
- user_id: UUID (User jisko review karna hai)
- reviewer_id: UUID (User jo review karega)
- assigned_by: UUID (Admin/Manager)
- assigned_at: Timestamp
- notes: Text (Optional)
- created_at: Timestamp
- updated_at: Timestamp
```

### Table: `tasks` (Updated)
```sql
- review_assignment_type: VARCHAR(20) ← NEW COLUMN!
  Values: 'group', 'individual', 'mixed'
```

## 🚀 How to Use

### Step 1: Run Database Migration

Supabase SQL Editor mein `UPDATE_INDIVIDUAL_PEER_REVIEWERS_TABLE.md` file ka SQL run karein:

```sql
-- Drop old table and create new task-specific table
DROP TABLE IF EXISTS individual_peer_reviewers CASCADE;

CREATE TABLE individual_peer_reviewers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_individual_peer_reviewers_task_id ON individual_peer_reviewers(task_id);
CREATE INDEX idx_individual_peer_reviewers_user_id ON individual_peer_reviewers(user_id);
CREATE INDEX idx_individual_peer_reviewers_reviewer_id ON individual_peer_reviewers(reviewer_id);

-- Unique constraint per task
CREATE UNIQUE INDEX idx_individual_peer_reviewers_unique_per_task 
ON individual_peer_reviewers(task_id, user_id);

-- Enable RLS
ALTER TABLE individual_peer_reviewers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view peer reviewer assignments for tasks they're involved in" 
ON individual_peer_reviewers FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = reviewer_id OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Admins and managers can manage peer reviewer assignments" 
ON individual_peer_reviewers FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_individual_peer_reviewers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_individual_peer_reviewers_updated_at
    BEFORE UPDATE ON individual_peer_reviewers
    FOR EACH ROW
    EXECUTE FUNCTION update_individual_peer_reviewers_updated_at();
```

### Step 2: Create Task with Individual Reviewers

1. **Navigate to Tasks page**
2. **Click "Create Task"**
3. **Fill basic details** (Title, Description, Due Date)
4. **Step 1: Assign to employees** (All or Specific)
5. **Step 2: Select Review Assignment Type**
   - Choose "Individual 1:1" or "Mixed"
6. **Step 3: Assign Individual Reviewers**
   - Har user ke liye dropdown se reviewer select karein
   - "No reviewer" option bhi available hai
7. **Submit**

### Step 3: View Assignments

Task create hone ke baad:
- Admin task details mein dekh sakta hai ki kis user ka reviewer kaun hai
- Reviewers apne assigned users ke responses dekh sakte hain
- Users apne reviewer ko dekh sakte hain

## 💡 Use Cases

### Use Case 1: Department-wise Review
```
Task: "Q1 Performance Review"
- Marketing Team → Marketing Manager
- Sales Team → Sales Manager
- Tech Team → Tech Lead
```

### Use Case 2: Skill-based Review
```
Task: "Code Review Assignment"
- Junior Dev A → Senior Dev X
- Junior Dev B → Senior Dev Y
- Mid-level Dev C → Tech Lead Z
```

### Use Case 3: Mixed Approach
```
Task: "Project Feedback"
Review Type: Mixed
- Group: All Project Managers (for oversight)
- Individual:
  - Designer A → Design Lead
  - Developer B → Tech Lead
  - QA C → QA Manager
```

## 🔄 Workflow

### Admin Workflow:
1. Create task
2. Assign employees
3. Choose review type (Group/Individual/Mixed)
4. If Individual/Mixed: Assign specific reviewers
5. Submit

### Employee Workflow:
1. View assigned task
2. Submit response
3. See who their reviewer is
4. Wait for feedback

### Reviewer Workflow:
1. See tasks where they are assigned as reviewer
2. View responses from their assigned users
3. Add remarks and ratings
4. Track review progress

## 📁 Files Modified

### New Files:
- `UPDATE_INDIVIDUAL_PEER_REVIEWERS_TABLE.md` - Database migration
- `TASK_SPECIFIC_PEER_REVIEWER_FEATURE.md` - This documentation

### Modified Files:
- `src/pages/Tasks.tsx` - Added individual reviewer selection UI
- `src/integrations/supabase/types.ts` - Updated table types
- `src/components/layout/DashboardLayout.tsx` - Removed unnecessary nav item
- `src/App.tsx` - Removed unnecessary route

### Removed Files:
- `src/pages/IndividualPeerReviewers.tsx` - No longer needed (task-specific now)

## ✨ Benefits

### For Admins:
- ✅ Maximum flexibility per task
- ✅ Easy user-to-reviewer mapping
- ✅ Visual dropdown selection
- ✅ No separate management page needed
- ✅ Everything in one place

### For Users:
- ✅ Clear visibility of their reviewer
- ✅ Consistent review experience
- ✅ Task-specific feedback

### For Reviewers:
- ✅ Clear list of assigned users per task
- ✅ Manageable workload
- ✅ Better context for feedback

## 🎨 UI Features

### Task Creation Form:
1. **Review Type Selector** (Radio buttons)
   - Group-based
   - Individual 1:1
   - Mixed

2. **Individual Reviewer Assignment Section** (Conditional)
   - Shows only when Individual or Mixed is selected
   - User cards with reviewer dropdowns
   - Real-time assignment count
   - Scrollable list for many users

3. **Visual Feedback**
   - Color-coded sections (Orange for type, Blue for assignments)
   - Icons for better UX
   - Assignment counter
   - Clear labels and descriptions

## 🔒 Security

- ✅ RLS policies ensure only authorized users can manage assignments
- ✅ Task-specific access control
- ✅ Users can only see their own assignments
- ✅ Reviewers can only see their assigned users
- ✅ Admins/Managers have full access

## 🚨 Important Notes

1. **Migration Required**: Database migration zaroor run karein
2. **No Global Assignments**: Ab assignments task-specific hain, global nahi
3. **Backward Compatible**: Existing group-based system bilkul same hai
4. **Flexible**: Har task ke liye different assignments ho sakti hain

## 📝 Example Scenarios

### Scenario 1: Training Program
```
Task: "Week 1 Training Assessment"
Type: Individual
- Trainee 1 → Mentor A
- Trainee 2 → Mentor B
- Trainee 3 → Mentor A
- Trainee 4 → Mentor C
```

### Scenario 2: Cross-functional Project
```
Task: "Sprint Review"
Type: Mixed
Groups: Product Team, QA Team
Individual:
- Backend Dev → Tech Lead
- Frontend Dev → UI Lead
- Designer → Design Head
```

### Scenario 3: Simple Group Review
```
Task: "Monthly Report"
Type: Group
Groups: Management Team
(All employees reviewed by management team)
```

## 🎯 Summary

Yeh feature aapke peer review system ko **maximum flexibility** deta hai:
- ✅ Task-specific assignments
- ✅ User-wise reviewer selection
- ✅ Group + Individual dono options
- ✅ Easy-to-use UI
- ✅ No separate management page
- ✅ Everything in task creation flow

Ab har task ke liye aap decide kar sakte hain ki kis user ka reviewer kaun hoga! 🚀
