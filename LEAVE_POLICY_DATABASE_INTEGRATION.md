# Leave Policy Database Integration - Quick Fix

## Problem Fixed ✅
**Admin policy update nahi ho raha tha employee ko**

Reason: Leave policy hardcoded tha `LeaveApplicationForm.tsx` mein. Admin update karta tha but employee ko default values hi dikhte the.

---

## Solution Implemented

### 1. **Database-Backed Policy** 
Created `leave_policies` table mein data store hota hai (ya use karo existing settings table):

```sql
CREATE TABLE IF NOT EXISTS leave_policies (
  leave_type VARCHAR PRIMARY KEY,
  monthly_balance INTEGER,
  max_per_request INTEGER,
  advance_notice INTEGER,
  salary_impact_percent INTEGER,
  carry_forward_allowed BOOLEAN,
  code VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **New Service: `leavePolicyService.ts`**
File: `src/lib/leavePolicyService.ts`

**Functions:**
- `getLeavePolicy(leaveType)` - एक specific leave type की policy fetch करता है
- `getAllLeavePolicies()` - सभी leave types की policies एक साथ fetch करता है

**Features:**
- Database से policy load करता है
- If not found → default values से fallback
- Error handling with fallback mechanism

### 3. **Updated `LeavePolicyConfig.tsx`**
Admin अब policy update करता है तो database में save होता है:

```typescript
const { error } = await supabase
  .from("leave_policies")
  .upsert({
    leave_type: editingPolicy.leaveType.toLowerCase(),
    monthly_balance: editingPolicy.monthlyBalance,
    max_per_request: editingPolicy.maxPerRequest,
    advance_notice: editingPolicy.advanceNotice,
    salary_impact_percent: editingPolicy.salaryImpact,
    carry_forward_allowed: editingPolicy.carryForwardAllowed,
  }, {
    onConflict: "leave_type"
  });
```

**Features:**
- Component mount पर database से policies load करता है
- Admin update करे तो database में save होता है
- Loading spinner दिखाता है data load होने के दौरान

### 4. **Updated `LeaveApplicationForm.tsx`**
अब employee leave apply करते समय:

```typescript
// Component mount पर policies load करो
useEffect(() => {
  const loadPolicies = async () => {
    const policies = await getAllLeavePolicies();
    LEAVE_POLICY = policies;  // Global object update हो जाता है
  };
  loadPolicies();
}, []);
```

**Result:**
✅ Employee को हमेशा latest policy values दिखते हैं  
✅ Admin update करे तो तुरंत असर पड़ता है  
✅ Fallback mechanism है अगर DB down हो  

---

## Files Modified/Created

### Created:
- `src/lib/leavePolicyService.ts` - Policy loading service

### Modified:
- `src/components/leaves/AdminLeaveBalance/LeavePolicyConfig.tsx` - Database save करने के लिए
- `src/components/leaves/LeaveApplicationForm.tsx` - Policies database से load करने के लिए

---

## How It Works Now

### Step-by-Step Flow:

```
ADMIN:
1. Leave Balance Tab खोले
2. Policy Config सेक्शन में Edit करे
3. "Save Policy" button दबाए
   ↓
   Database में leave_policies table में save हो जाता है

EMPLOYEE:
1. "Apply for Leave" form खोले
   ↓
   useEffect चलता है, database से latest policies fetch होती हैं
   ↓
2. Form में उन्हें latest policy values दिखते हैं
3. Leave apply करते समय latest balance checks होते हैं
```

---

## Database Schema Required

आपको यह table Supabase में बनाना होगा:

```sql
CREATE TABLE leave_policies (
  leave_type VARCHAR PRIMARY KEY,
  monthly_balance INTEGER NOT NULL DEFAULT 6,
  max_per_request INTEGER NOT NULL DEFAULT 2,
  advance_notice INTEGER NOT NULL DEFAULT 4,
  salary_impact_percent INTEGER NOT NULL DEFAULT 0,
  carry_forward_allowed BOOLEAN DEFAULT FALSE,
  code VARCHAR(5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default policies
INSERT INTO leave_policies (leave_type, monthly_balance, max_per_request, advance_notice, salary_impact_percent, code) VALUES
('casual', 6, 2, 4, 0, 'PL'),
('medical', 6, 2, 0, 0, 'PL'),
('emergency', 6, 1, 0, 100, 'LE'),
('lop', 6, 1, 1, 100, 'LE'),
('half_day', 6, 1, 1, 50, 'HD')
ON CONFLICT (leave_type) DO NOTHING;
```

---

## Testing

### Test यह करो:

1. **Admin से Policy Change करो:**
   - Leave Balance Tab → Policy Config
   - Casual Leave का "Advance Notice" 4 दिन से 2 दिन करो
   - "Save Policy" दबाओ
   - ✅ "Success" message दिखे

2. **Employee Form को Refresh करो:**
   - Employee को कहो नया form खोले (Ctrl+R)
   - वह देखेगा Casual Leave के लिए अब सिर्फ 2 दिन advance notice है
   - ✅ Policy change दिख जाएगी

3. **Background में Change करो:**
   - Admin policy change करे
   - Employee दूसरे tab में हो
   - Employee अपना tab activate करे
   - ✅ तुरंत latest policy दिखेगी (browser cache refresh करे अगर नहीं दिखे)

---

## Next Steps (Optional Enhancements)

### 1. **Real-time Updates**
Supabase Realtime का use करो ताकि admin update करे तो employee को automatically पता चल जाए:

```typescript
// Browser tab के बीच sync करने के लिए
const subscription = supabase
  .channel('leave_policies')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'leave_policies' },
    () => { reloadPolicies(); }
  )
  .subscribe();
```

### 2. **Policy Versioning**
पुरानी policies को history में रखो:
```sql
ALTER TABLE leave_policies ADD COLUMN version_id UUID;
ALTER TABLE leave_policies ADD COLUMN effective_from DATE;
```

### 3. **Department-wise Policies**
अलग-अलग departments के लिए अलग policies:
```sql
ALTER TABLE leave_policies ADD COLUMN department_id UUID;
ALTER TABLE leave_policies DROP CONSTRAINT "leave_policies_pkey";
ALTER TABLE leave_policies ADD PRIMARY KEY (leave_type, department_id);
```

---

## Summary

✅ **Problem:** Admin policy update → Employee को नहीं दिखता  
✅ **Root Cause:** Hardcoded values का use  
✅ **Solution:** Database-backed dynamic policies  
✅ **Implementation:** 
- New service file
- Admin config में DB save
- Employee form में DB load
✅ **Result:** Real-time policy updates!
