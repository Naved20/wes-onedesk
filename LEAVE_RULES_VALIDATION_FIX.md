# Leave Rules Validation Fix - August 8, 2026

## Problem
The **Leave Rules Configuration** UI allowed admins to set rules (max per request, max per month, advance notice, etc.), but these rules were **NOT being used** during leave validation!

### What Was Happening
1. ✅ Admin sets rules in UI → saved to `leave_rules_config` table
2. ❌ Employee submits leave → database trigger uses **HARDCODED** rules instead
3. ❌ Rules mismatch - Employee sees different limits than what admin configured

### Hardcoded Rules (Before Fix)
- **Casual Leave**: Max 2 per month, 3 days advance notice (FIXED)
- **Weekly Limit**: Max 1 leave per week regardless of type (WRONG)
- **Emergency Leave**: Special treatment (correct)

## Solution

### Migration: `20260808_fix_leave_validation_use_config.sql`

**Changes Made:**

1. **Updated `check_leave_eligibility()` function:**
   - ❌ Removed hardcoded values for casual leaves
   - ✅ Now **FETCHES rules from `leave_rules_config` table**
   - ✅ Uses fetched values for ALL leave types (not just casual)

2. **Validation Rules Applied:**
   - **Rule 1:** Max days per request
   - **Rule 2:** Advance notice requirement
   - **Rule 3:** Monthly limit
   - **Rule 4:** Weekly limit (per leave type)
   - **Rule 5:** Minimum gap between requests

3. **Updated `validate_leave_request()` trigger:**
   - ❌ Removed casual-only hardcoded logic
   - ✅ Now applies same validation to ALL leave types
   - ✅ Emergency leaves still get special treatment (skip certain validations)

## How It Works Now

### When Employee Submits Leave:

```
1. Database Trigger fires (before insert)
   ↓
2. Calculates working days
   ↓
3. Calls check_leave_eligibility()
   ↓
4. Fetches rules from leave_rules_config:
   - SELECT max_per_request, max_per_week, max_per_month, min_gap_between_requests, advance_notice_days
   - FROM leave_rules_config WHERE leave_type = 'casual'
   ↓
5. Validates against each rule
   ↓
6. If ANY rule fails:
   - Sets auto_rejected = true
   - Sets auto_rejection_reason with specific error message
   ↓
7. Leave record created with rejection status
```

## Data Flow

### Configuration Tables:
```
leave_rules_config
├── leave_type: 'casual', 'medical', 'emergency', 'lop', 'half_day'
├── max_per_request: N (from UI)
├── max_per_week: N (from UI)
├── max_per_month: N (from UI)
├── min_gap_between_requests: N (from UI)
└── advance_notice_days: N (from UI)  ← NOW USED FOR VALIDATION

leave_balance_config
├── leave_type
├── monthly_balance: N (from UI)
├── salary_impact_percent: N (from UI)
└── carry_forward_allowed: bool (from UI)
```

### During Validation:
```
check_leave_eligibility() function
├── Fetches rules from leave_rules_config
├── Validates against:
│   ├── Max per request
│   ├── Advance notice
│   ├── Monthly total
│   ├── Weekly total
│   └── Gap between requests
└── Returns: { eligible: bool, reason: string, working_days: number }
```

## Error Messages Now Show Correctly

### Before Fix:
```
"Monthly casual leave limit (2 days) reached. Used: 3.0/2"
❌ Confusing - shows used count + requested as sum
```

### After Fix:
```
"Monthly casual leave limit (5 days) would be exceeded. You have used 2 day(s) and are requesting 1 more day(s)."
✅ Clear - shows current used + requested separately
```

## Testing the Fix

### Step 1: Deploy Migration
```bash
supabase db push
```

### Step 2: Set Rules in UI
Go to **Admin → Leave Rules Configuration**
- Casual: Max 4 per request, 5 per month, 0 advance notice
- Medical: Max 2 per request, 2 per month, 2 advance notice
- etc.

### Step 3: Employee Tries to Apply
- Employee applies for casual leave
- ✅ Gets validated against rules from UI
- Error message shows actual limits from database

### Test Cases:

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Employee applies within limits | ✅ Approved | ✅ Approved |
| Employee exceeds max per month | ❌ Hardcoded error (2 days) | ✅ Shows actual limit from config |
| Employee applies < advance notice | ❌ Hardcoded 3 days | ✅ Shows actual advance notice from config |
| Casual leave > 1 day | ❌ Shows weird error | ✅ Shows max_per_request from config |
| Medical leave with 2-day gap rule | ❌ No validation | ✅ Validates gap from config |

## Files Modified

1. **Migration Created:**
   - `supabase/migrations/20260808_fix_leave_validation_use_config.sql`

2. **Database Functions Updated:**
   - `check_leave_eligibility()` - Now uses `leave_rules_config` table
   - `validate_leave_request()` - Removed hardcoded casual-only logic

3. **No Frontend Changes Needed:**
   - LeaveApplicationForm already uses rules from database
   - LeaveRulesConfig UI already saves to correct table
   - Everything was ready - just needed backend to use the data!

## Important Notes

### Default Rules (if rule not found in database):
```sql
- max_per_request: 1 day
- max_per_week: 2 days
- max_per_month: 6 days
- min_gap_between_requests: 0 days
- advance_notice_days: 0 days
```

### Emergency Leaves:
- Skip: Advance notice check
- Skip: Weekly limit check
- Still check: Monthly limit, max per request

### Carry Forward:
- Still handled by `reset-leave-balances` Edge Function
- Not affected by this fix

## Deployment Steps

1. **Create migration:**
   ```bash
   supabase migration create fix_leave_validation_use_config
   ```

2. **Copy content from `20260808_fix_leave_validation_use_config.sql`**

3. **Deploy:**
   ```bash
   supabase db push
   ```

4. **Verify:**
   - Check database functions updated: `\df check_leave_eligibility`
   - Try submitting a leave application
   - Check error messages use actual configured limits

## Next Steps

1. ✅ Deploy migration
2. ✅ Test with various rule configurations
3. ✅ Monitor leave rejections for proper error messages
4. Optionally: Add admin logging to see which rules rejected which leaves
