# Complete Leave Balance System Analysis

**Date:** July 30, 2026  
**Status:** Diagnosis Only - No Code Changes

---

## Table of Contents
1. [Database Schema](#database-schema)
2. [Leave Policy Configuration](#leave-policy-configuration)
3. [Balance Calculation Logic](#balance-calculation-logic)
4. [Complete Workflow](#complete-workflow)
5. [Database Triggers](#database-triggers)
6. [Balance Reset Mechanism](#balance-reset-mechanism)
7. [Edge Cases & Issues](#edge-cases--issues)
8. [Architecture Diagram](#architecture-diagram)

---

## Database Schema

### 1. `leaves` Table (18 Columns)
Stores individual leave requests with full details.

```sql
Column Name              | Type        | Nullable | Purpose
─────────────────────────┼─────────────┼──────────┼──────────────────────
id                       | UUID        | NO       | Primary key
user_id                  | UUID        | NO       | Employee who requested leave
start_date               | DATE        | NO       | First day of leave
end_date                 | DATE        | NO       | Last day of leave
leave_type               | ENUM        | YES      | casual|medical|emergency|lop|half_day
reason                   | TEXT        | NO       | Why employee is taking leave
status                   | ENUM        | YES      | pending|approved|rejected
is_half_day              | BOOLEAN     | YES      | Whether it's a half-day leave
half_day_type            | VARCHAR     | YES      | first_half|second_half
is_emergency             | BOOLEAN     | YES      | Marked as emergency leave
working_days_count       | NUMERIC     | YES      | Business days (excludes Sundays)
salary_deduction_percent | NUMERIC     | YES      | 0=No deduction, 50=50%, 100=Full LOP
approved_by              | UUID        | YES      | Manager who approved
approved_at              | TIMESTAMP   | YES      | When approval happened
rejection_reason         | TEXT        | YES      | If rejected, why
auto_rejected            | BOOLEAN     | YES      | System auto-rejected (e.g., no proof)
auto_rejection_reason    | TEXT        | YES      | Reason for auto-rejection
medical_document_url     | VARCHAR     | YES      | Medical proof URL
created_at               | TIMESTAMP   | NO       | When leave was requested
updated_at               | TIMESTAMP   | NO       | Last update timestamp
```

### 2. `leave_balances` Table (7 Columns)
Tracks monthly leave usage per employee, resets each month.

```sql
Column Name              | Type        | Nullable | Purpose
─────────────────────────┼─────────────┼──────────┼──────────────────────
id                       | UUID        | NO       | Primary key
user_id                  | UUID        | NO       | Employee
year                     | INTEGER     | NO       | Year (e.g., 2026)
month                    | INTEGER     | NO       | Month (1-12)
casual_leaves_used       | NUMERIC     | YES      | Count of casual leaves used
medical_leaves_used      | NUMERIC     | YES      | Count of medical leaves used
emergency_leaves_used    | NUMERIC     | YES      | Count of emergency leaves used
lop_leaves_used          | NUMERIC     | YES      | Count of LOP leaves used
half_day_leaves_used     | NUMERIC     | YES      | Count of half-day leaves used (0.5 each)
created_at               | TIMESTAMP   | YES      | Record creation date
updated_at               | TIMESTAMP   | YES      | Last update date
```

**Key Points:**
- PRIMARY KEY: (user_id, year, month) - Unique per employee per month
- Each column tracks USAGE (count), not remaining balance
- No carry-over between months
- New record created on 1st of each month (or on first employee access)

---

## Leave Policy Configuration

### Policy Constants (Hardcoded in LeaveApplicationForm.tsx)

```typescript
const LEAVE_POLICY: Record<LeaveType, {
  label: string;              // Display name
  code: string;               // Short code (PL, LE, HD)
  advanceDays: number;        // Days notice required
  maxDaysAtTime: number;      // Max consecutive days allowed
  balance: number;            // Total monthly allocation
  salaryImpact: string;       // Display text for salary effect
  salaryImpactShort: string;  // Short version
  proofSubmission: string;    // When proof needed
  purpose: string;            // Description
}> = {
  casual: {
    label: "Casual Leave",
    code: "PL",
    advanceDays: 4,           // 4 days notice required
    maxDaysAtTime: 2,         // Max 2 days at once
    balance: 6,               // 6 days per month
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Planned personal work or short planned absence"
  },
  medical: {
    label: "Medical Leave",
    code: "PL",
    advanceDays: 0,           // Same day approval
    maxDaysAtTime: 2,
    balance: 6,
    salaryImpact: "Paid Time Off",
    salaryImpactShort: "No deduction",
    proofSubmission: "At Request Time",
    purpose: "Medical/health-related leave"
  },
  emergency: {
    label: "Emergency Leave",
    code: "LE",
    advanceDays: 0,           // Same day
    maxDaysAtTime: 1,         // Only 1 day at a time
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "After 2 Days",
    purpose: "Sudden unavoidable emergency"
  },
  lop: {
    label: "Leave Without Pay / LOP",
    code: "LE",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "1 LOP",
    salaryImpactShort: "1 day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Unpaid leave"
  },
  half_day: {
    label: "Half-Day Leave",
    code: "HD",
    advanceDays: 1,
    maxDaysAtTime: 1,
    balance: 6,
    salaryImpact: "0.5 LOP",
    salaryImpactShort: "Half day salary deduction",
    proofSubmission: "At Request Time",
    purpose: "Leave for half working day"
  }
}
```

### Leave Group Display (LeaveBalanceCard.tsx)

```typescript
LEAVE_GROUPS = [
  {
    code: "PL",
    label: "Paid Leave",
    totalBalance: 12,  // casual (6) + medical (6)
    types: [
      { key: "casual_leaves_used", label: "Casual Leave", limit: 6 },
      { key: "medical_leaves_used", label: "Medical Leave", limit: 6 }
    ]
  },
  {
    code: "LE",
    label: "Leave",
    totalBalance: 12,  // emergency (6) + lop (6)
    types: [
      { key: "emergency_leaves_used", label: "Emergency Leave", limit: 6 },
      { key: "lop_leaves_used", label: "LOP", limit: 6 }
    ]
  },
  {
    code: "HD",
    label: "Half Day",
    totalBalance: 6,
    types: [
      { key: "half_day_leaves_used", label: "Half-Day Leave", limit: 6 }
    ]
  }
]
```

---

## Balance Calculation Logic

### How Remaining Balance is Calculated

```typescript
// In LeaveApplicationForm.tsx
const getRemainingBalance = (type: LeaveType) => {
  if (!leaveBalancesUsed) {
    return LEAVE_POLICY[type].balance;  // Default = 6
  }
  const used = leaveBalancesUsed[type] || 0;  // Get from leave_balances table
  return Math.max(0, LEAVE_POLICY[type].balance - used);  // 6 - used
};

// Example:
// If casual_leaves_used = 4 in leave_balances table
// Remaining = 6 - 4 = 2 days
// Display: "2/6 remaining"
```

### Balance Used Calculation

When a leave is APPROVED:
```typescript
// In Leaves.tsx - updateLeaveBalance() function
const increment = type === 'half_day' ? 0.5 : 1;

// Get current balance record for this month/year
const { data: bal } = await supabase
  .from('leave_balances')
  .select('*')
  .eq('user_id', userId)
  .eq('month', month)
  .eq('year', year)
  .maybeSingle();

// Increment the appropriate column
if (bal) {
  const current = Number(bal[column]) || 0;
  await supabase
    .from('leave_balances')
    .update({ [column]: current + increment })  // Add 1 or 0.5
    .eq('id', bal.id);
}
```

### Column Mapping (Leave Type → Database Column)

```typescript
const columnMap: Record<string, string> = {
  'casual': 'casual_leaves_used',
  'medical': 'medical_leaves_used',
  'emergency': 'lop_leaves_used',      // ← Emergency stored as LOP!
  'lop': 'lop_leaves_used',
  'half_day': 'half_day_leaves_used'
};
```

---

## Complete Workflow

### Phase 1: Leave Application

**Actors:** Employee  
**Component:** LeaveApplicationForm.tsx

```
1. Employee clicks "Apply for Leave"
   ↓
2. Form opens with LEAVE_POLICY loaded
   ↓
3. Employee selects:
   - Leave type (casual, medical, emergency, lop, half_day)
   - Start date (must be ≥ advanceDays from now)
   - End date (if not half-day)
   - Reason
   - Half-day type (first_half or second_half)
   ↓
4. Form validates:
   ✓ Start date is not Sunday
   ✓ Start date ≥ advanceDays notice
   ✓ End date ≤ Start date + maxDaysAtTime
   ✓ Remaining balance > 0
   ✓ No form submission if validation fails
   ↓
5. Calculate working_days (via RPC or fallback calculation)
   ↓
6. Submit to leaves table:
   INSERT INTO leaves (
     user_id, start_date, end_date, leave_type,
     reason, status, is_half_day, working_days_count
   ) VALUES (...)
   
   Default values:
   - status = 'pending'
   - is_emergency = false
   - salary_deduction_percent = NULL (set during approval)
   ↓
7. Send notification: leaveNotifications.applied()
   ↓
8. Form closes, balance display refreshes
```

### Phase 2: Leave Approval/Rejection

**Actors:** Manager or Admin  
**Component:** LeaveApprovalDialog.tsx

```
APPROVAL PATH:
1. Manager opens LeaveApprovalDialog
   ↓
2. Dialog shows:
   - Casual leave nth indicator (1st or 2nd this month?)
   - Salary deduction impact
   - Auto-rejection warnings
   ↓
3. Manager clicks "Approve"
   ↓
4. UPDATE leaves SET status='approved'
   WHERE id=leaveId
   ↓
5. DATABASE TRIGGER: sync_leave_to_attendance_insert()
   FIRES automatically!
   ├─ Maps leave_type to attendance.calculated_status:
   │  ├─ casual, medical → 'paid_leave'
   │  └─ emergency, lop → 'leave'
   ├─ For each day in leave period (excluding Sundays):
   │  └─ INSERT/UPDATE attendance record
   └─ Sets:
      - attendance.status = 'approved'
      - attendance.is_manual_override = true
      - attendance.notes = 'Auto-synced from leave'
   ↓
6. In Leaves.tsx: handleApprove()
   ├─ Call updateLeaveBalance(leave)
   │  ├─ Get leave_balances for this month/year
   │  ├─ Increment appropriate column
   │  └─ Set salary_deduction_percent based on type:
   │     ├─ emergency → 100
   │     └─ medical → 0
   └─ Send notification: leaveNotifications.approved()
   ↓
7. Balance display updates

REJECTION PATH:
1. Manager clicks "Reject" button
   ↓
2. Manager enters rejection reason
   ↓
3. UPDATE leaves SET status='rejected',
      rejection_reason='...'
   ↓
4. NO TRIGGER fires (only on approved)
   No attendance records created
   ↓
5. Send notification: leaveNotifications.rejected()
```

### Phase 3: Balance Display

**Component:** LeaveBalanceCard.tsx + Leaves.tsx

```
1. On page load:
   - fetchLeaveBalance() called
   - Query leave_balances for current year/month
   - If no record exists: CREATE new record with all columns = 0
   ↓
2. In LeaveBalanceCard:
   - For each LEAVE_GROUP:
     ├─ Sum usage across all types
     ├─ Calculate totalUsed = sum
     ├─ Calculate totalRemaining = totalBalance - totalUsed
     ├─ Show usage bar: totalUsed/totalBalance
     └─ Show individual breakdown:
        ├─ casual: X/6 used
        ├─ medical: Y/6 used
        └─ etc.
   ↓
3. Visual indicators:
   - Green badge: balance > 0
   - Amber warning: balance = 1 (last leave)
   - Red badge: balance = 0 (exhausted)
```

---

## Database Triggers

### Trigger 1: `trg_sync_leave_to_attendance` (UPDATE)

**When:** After UPDATE on leaves table  
**Condition:** status changes TO 'approved'

```sql
FUNCTION sync_leave_to_attendance():
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    Map leave_type to calculated_status:
      casual, medical → 'paid_leave'
      emergency, lop, sick, unplanned → 'leave'
      others → 'leave'
    
    FOR each date FROM start_date TO end_date:
      IF NOT is_holiday_date(date) THEN  -- Skip holidays
        INSERT INTO attendance (
          user_id, date, status='approved',
          calculated_status, is_half_day, half_day_type,
          is_manual_override=true, notes='Auto-synced from leave',
          approved_at=NOW(), approved_by=user_id
        )
        ON CONFLICT (user_id, date) DO UPDATE:
          SET status='approved', calculated_status, is_half_day, ...
      END IF
    END LOOP
  END IF
  
  -- Reversion logic:
  IF OLD.status = 'approved' AND NEW.status IS NOT 'approved' THEN
    UPDATE attendance
    SET status='pending', calculated_status=NULL,
        is_manual_override=false,
        notes='Leave revoked'
    WHERE user_id=OLD.user_id
      AND date BETWEEN OLD.start_date AND OLD.end_date
      AND notes LIKE '%' || OLD.id || '%'
  END IF
```

### Trigger 2: `trg_sync_leave_to_attendance_insert()` (INSERT)

**When:** After INSERT on leaves table  
**Condition:** If inserted with status='approved'

Same logic as UPDATE trigger, but handles new leaves that are pre-approved.

---

## Balance Reset Mechanism

### Monthly Reset Strategy

```
System: MONTHLY RESET (No Carryover)
Period: Month (1st to 28/29/30/31)
Trigger: MANUAL (on first access each month)

Process:
1. Employee accesses Leaves page
2. fetchLeaveBalance() runs:
   ├─ Get current month/year
   ├─ Query leave_balances WHERE user_id=X AND year=Y AND month=M
   ├─ If record exists:
   │  └─ Display current usage
   └─ If NO record exists:
      └─ INSERT new record with all columns = 0
         (New month = fresh 6 days for each type)

Timeline Example:
─────────────────────────────────────
July 2026:
  casual_leaves_used: 4
  emergency_leaves_used: 1
  remaining: 2 casual, 5 emergency

August 1, 2026 (next month):
  ↓ New record created
  casual_leaves_used: 0  ← RESET!
  emergency_leaves_used: 0  ← RESET!
  remaining: 6 casual, 6 emergency
─────────────────────────────────────
```

### What happens to old months?

```
Historical records are NEVER deleted.
They persist in leave_balances table for auditing.

Query: SELECT * FROM leave_balances WHERE user_id='X'
Returns: [
  { user_id: 'X', year: 2026, month: 1, casual_leaves_used: 5, ... },
  { user_id: 'X', year: 2026, month: 2, casual_leaves_used: 6, ... },
  { user_id: 'X', year: 2026, month: 3, casual_leaves_used: 2, ... },
  ...
  { user_id: 'X', year: 2026, month: 7, casual_leaves_used: 4, ... }  ← Current
]
```

### No Yearly Reset

❌ No logic found for:
- Carryover to next year
- Annual balance allocation
- Year-end reset
- Unused leave expiration

---

## Edge Cases & Issues

### 1. No Carryover Between Months ⚠️

**Issue:** Leaves don't carry over. If employee has 2 unused casual leaves in July, they're lost.

```typescript
// No logic like:
UPDATE leave_balances
SET casual_leaves_used = 0
WHERE month = 8  -- Carry July's 2 unused to August
```

**Current Behavior:** Fresh 6 days each month, unused days lost.

**Risk:** Employees lose days if they don't use them by month-end.

---

### 2. Manual Balance Manipulation Risk ⚠️

**Issue:** No validation prevents over-allocation via direct database edits.

```sql
-- Admin could do this directly:
UPDATE leave_balances
SET casual_leaves_used = 100  -- Way over 6 limit
WHERE user_id='X' AND month=7;

-- UI would still allow more leave approvals (no sync)
```

**Current Behavior:** No constraint or trigger prevents this.

**Risk:** Inconsistent data if database edited outside UI.

---

### 3. Working Days Calculation Fallback ⚠️

**Issue:** RPC function `calculate_working_days` referenced but not found in codebase.

```typescript
// In LeaveApplicationForm.tsx:
const { data, error } = await supabase.rpc("calculate_working_days", {
  p_start_date: startDate,
  p_end_date: endDate,
});

// If RPC fails or doesn't exist:
// Fallback to simple Sunday exclusion
let count = 0;
while (current <= end) {
  if (!isSunday(current)) count++;  // Counts all non-Sundays
  current.setDate(current.getDate() + 1);
}
```

**Problem:** Doesn't account for holidays, only Sundays.

**Risk:** Leave with holidays miscounted.

---

### 4. Race Condition in Balance Creation 🔴

**Issue:** Multiple simultaneous requests could create duplicate leave_balances records.

```typescript
// fetchLeaveBalance() - NOT atomic:
const { data } = await supabase
  .from('leave_balances')
  .select('*')
  .eq('month', month)
  .eq('year', year);

if (!data) {  // No record
  const { data: newBalance } = await supabase
    .from('leave_balances')
    .insert({ user_id, month, year })  // ← Between check and insert,
    .select()                            // another request could insert too!
    .single();
}
```

**Scenario:**
- Request A: Checks, no record found
- Request B: Checks, no record found
- Request A: Inserts new record
- Request B: Inserts another record  ← DUPLICATE!

**Fix:** Use Supabase's `upsert` or add unique constraint.

---

### 5. Salary Deduction Mismatch 🟡

**Issue:** `salary_deduction_percent` not validated against `leave_type`.

```typescript
// In updateLeaveBalance():
if (type === 'emergency') {
  update({ salary_deduction_percent: 100 });
} else if (type === 'medical') {
  update({ salary_deduction_percent: 0 });
}
// But what if type='casual' and someone manually set it to 50?
// No validation catches this
```

**Risk:** Display shows wrong salary impact.

---

### 6. Incomplete Approval Reversion 🟡

**Issue:** When leave is un-approved, attendance records revert to "pending" but aren't deleted.

```sql
-- From trigger:
UPDATE attendance
SET status = 'pending',
    calculated_status = NULL,
    is_half_day = false,
    half_day_type = NULL,
    notes = 'Leave revoked - reverted to pending'
WHERE user_id = OLD.user_id
  AND date BETWEEN OLD.start_date AND OLD.end_date;

-- Problem: Record still exists, marks employee as "pending attendance"
-- Better: DELETE the record since it's no longer a leave
```

**Risk:** Confuses attendance history.

---

### 7. Half-Day Decimal Handling 🟡

**Issue:** Half-day leaves increment by 0.5, but some UI/calculations may assume integers.

```typescript
// Balance: half_day_leaves_used = 2.5
// Display: "2.5/6 used"

// But rendering might truncate:
Math.floor(2.5)  // = 2, displays as "2 used" ← WRONG
```

**Risk:** Display inaccuracy.

---

### 8. No Audit Trail 🟠

**Issue:** No tracking of who changed balance or when.

```sql
-- Current:
UPDATE leave_balances
SET casual_leaves_used = 5
WHERE user_id='X';

-- No record of:
-- - Who made this change?
-- - Was it from leave approval or manual edit?
-- - When exactly?
-- - What was the previous value?
```

**Risk:** Can't audit balance changes.

---

### 9. Auto-Rejection Feature Incomplete 🔴

**Issue:** Database columns exist but triggering logic not found.

```typescript
// Table has:
auto_rejected: boolean
auto_rejection_reason: string

// But where does this get set?
// Query: grep -r "auto_rejected = true" → NO RESULTS!
```

**Mystery:** Feature exists in schema but no implementation.

---

### 10. Month Boundary Leaves 🟡

**Issue:** Leave spanning month boundary only counts current month for balance.

```typescript
// Leave: July 25 - Aug 5
// When approved in July, balance counted in July's leave_balances record
// August's balance NOT incremented

// Result:
// July: casual_leaves_used = 7 (over 6!)
// Aug: casual_leaves_used = 0 (should include Aug portion)
```

**Risk:** Inconsistent balance tracking.

---

## Architecture Diagram

### Data Flow: Leave Application → Approval → Attendance

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEAVE APPLICATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Employee Application
┌──────────────────────┐
│  Employee (Frontend) │
│  LeaveApplicationForm│
└──────────┬───────────┘
           │
           │ Validate:
           │ ✓ Not Sunday
           │ ✓ Advance notice
           │ ✓ Balance check
           │ ✓ Max days limit
           │
           ↓
┌──────────────────────────────────┐
│   Supabase: leaves TABLE         │
│   INSERT with status='pending'   │
│   ├─ user_id                     │
│   ├─ start_date / end_date       │
│   ├─ leave_type                  │
│   ├─ reason                      │
│   └─ working_days_count          │
└──────────┬───────────────────────┘
           │
           │ Send notification
           ↓
  leaveNotifications.applied()


STEP 2: Manager Approval
┌──────────────────────┐
│  Manager (Frontend)  │
│ LeaveApprovalDialog  │
│ Clicks: "Approve"    │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────────────────┐
│ UPDATE leaves                    │
│ SET status='approved'            │
│     approved_by=manager_id       │
│     approved_at=NOW()            │
└──────────┬───────────────────────┘
           │
           │ (Database Trigger Fires!)
           │
           ↓
┌──────────────────────────────────┐
│ TRIGGER: sync_leave_to_attendance│
│ For each day (excl. Sundays):    │
│   INSERT/UPDATE attendance       │
│   ├─ status='approved'           │
│   ├─ calculated_status='paid_...│
│   ├─ is_manual_override=true     │
│   └─ notes='Auto-synced'         │
└──────────┬───────────────────────┘
           │
           │ (Application Handles)
           │
           ↓
┌──────────────────────────────────┐
│ updateLeaveBalance() in Leaves.tsx
│ GET leave_balances for month     │
│ ├─ Get column (casual/medical/..)
│ └─ INCREMENT by 1 or 0.5         │
│                                  │
│ SET salary_deduction_percent:    │
│ ├─ emergency → 100%              │
│ └─ medical → 0%                  │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│ Supabase: leave_balances TABLE   │
│ UPDATE column = old + increment  │
│ Example:                         │
│ casual_leaves_used: 3 → 4        │
│ (6 - 4 = 2 remaining)            │
└──────────┬───────────────────────┘
           │
           │ Send notification
           ↓
  leaveNotifications.approved()


STEP 3: Balance Display
┌──────────────────────┐
│  Employee (Frontend) │
│  Leaves.tsx Page     │
│  LeaveBalanceCard    │
└──────────┬───────────┘
           │
           │ fetchLeaveBalance()
           │
           ↓
┌──────────────────────────────────┐
│ Query leave_balances             │
│ WHERE user_id=X                  │
│   AND year=2026                  │
│   AND month=7 (current)          │
└──────────┬───────────────────────┘
           │
           │ If no record: CREATE with 0s
           │
           ↓
┌──────────────────────────────────┐
│ Calculate Remaining for Display: │
│ ├─ Casual: 6 - 4 = 2 remaining   │
│ ├─ Medical: 6 - 1 = 5 remaining  │
│ ├─ Emergency: 6 - 0 = 6 remaining│
│ └─ ...                           │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│ LeaveBalanceCard renders:        │
│ ┌─ PL (Paid Leave): 7/12 used    │
│ │  ├─ Casual: 4/6 used           │
│ │  └─ Medical: 1/6 used          │
│ ├─ LE (Leave): 0/12 used         │
│ │  ├─ Emergency: 0/6 used        │
│ │  └─ LOP: 0/6 used              │
│ └─ HD (Half Day): 0/6 used       │
└──────────────────────────────────┘
```

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Tables** | `leaves` (18 cols), `leave_balances` (7 cols) |
| **Leave Types** | casual, medical, emergency, lop, half_day |
| **Balance per Type** | 6 days/month (all types) |
| **Reset Period** | Monthly (1st of each month) |
| **Carryover** | None - resets to 0 each month |
| **Approval Auto-Sync** | Yes, via database trigger → attendance table |
| **Salary Deduction** | Casual/Medical=0%, Emergency/LOP=100%, Half=50% |
| **Holiday Handling** | Excluded from working_days count |
| **Sunday Handling** | Excluded from working_days count |
| **Audit Trail** | None |
| **Manual Override** | Yes, via direct database edits (risky) |
| **Race Conditions** | Possible in balance creation |
| **Auto-Rejection** | Schema exists but logic not found |

---

## End of Analysis

This document comprehensively maps the entire leave balance system without proposing any code changes, as requested.
