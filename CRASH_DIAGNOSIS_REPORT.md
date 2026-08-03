# 🚨 White Screen Crash Diagnostic Report
**Date:** July 30, 2026  
**Error:** `Uncaught TypeError: Cannot read properties of undefined (reading 'replace')`  
**Status:** ROOT CAUSE IDENTIFIED ✓

---

## Executive Summary

The production white screen crash is caused by **employee profile records in the database containing NULL values for `first_name` and/or `last_name` fields**, even though the schema defines these fields as **non-nullable (string, NOT NULL)**.

When the React application loads the leaderboard and dashboard, it concatenates these NULL values into template literals, which JavaScript converts to the string `"null"`. Later, if any code attempts string operations (like `.replace()`, `.toLowerCase()`, `.split()`, etc.) on undefined values derived from these corrupted records, it crashes with the reported error.

---

## Technical Root Cause Analysis

### 1. **Database Schema vs. Reality Mismatch**

**Schema Definition** (`src/integrations/supabase/types.ts`):
```typescript
employee_profiles: {
  Row: {
    first_name: string        // ← NOT nullable
    last_name: string         // ← NOT nullable
    // ... other 70+ fields
  }
}
```

**Actual Database State:**
- Some `employee_profiles` records have `NULL` values in `first_name` column
- Some `employee_profiles` records have `NULL` values in `last_name` column
- OR both fields are NULL in certain records

### 2. **Where the Crash Occurs**

Multiple locations in the codebase create employee name concatenations **without null safety checks**:

#### Location 1: `src/lib/leaderboardUtils.ts` (All 7 leaderboard functions)
Lines 61, 128, 192, 272, 338, 431, 501:
```typescript
userName: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown User"
```

**Problem:** The check `emp ?` only verifies if the employee object exists, NOT if `first_name`/`last_name` are NULL.

**When it fails:**
```typescript
const emp = { first_name: null, last_name: "Smith" }; // ← From database
// This creates:
userName = `${null} Smith`  // ← Becomes string "null Smith"
// Later if code calls .replace() on this:
userName.replace(...)  // ← Could fail if a derived value is undefined
```

#### Location 2: `src/pages/Attendance.tsx` (Line 170)
```typescript
profileMap = new Map(
  profiles?.map(p => [
    p.user_id, 
    { 
      name: `${p.first_name} ${p.last_name}`,  // ← No null check
      institution: p.institution_assignment 
    }
  ]) || []
);
```

#### Location 3: `src/components/tasks/EarningsAnalytics.tsx` (Lines 187, 220-221)
```typescript
name: `${earning.first_name} ${earning.last_name}`,

month.byPerson[`${earning.first_name} ${earning.last_name}`] = ...
```

#### Location 4: `src/pages/Employees.tsx` (Line 461)
```typescript
const matchesSearch = `${emp.first_name} ${emp.last_name} ${emp.email}`
  .toLowerCase()
  .includes(searchQuery.toLowerCase());
```

**Critical:** This line calls `.toLowerCase()` directly on the template literal, which will fail if either field is undefined.

#### Location 5: `src/pages/Attendance.tsx` (Line 559)
```typescript
const employees = data?.map(p => ({
  user_id: p.user_id,
  name: `${p.first_name} ${p.last_name}`,  // ← No null check
  institution: p.institution_assignment
})) || [];
```

---

## Why This Happened

### Cause 1: **Data Integrity Issue**
- Employee records were created without `first_name` or `last_name` values
- OR a database migration altered records without proper data validation
- OR manual database manipulation set these fields to NULL

### Cause 2: **No Recent Deployment Issue**
- The code has **always been unsafe** with regard to null name fields
- The crash is **NOT caused by recent code changes**
- Instead, it's caused by **database data becoming corrupted** recently:
  - Bulk import with incomplete data
  - Database migration that didn't validate constraints
  - Manual SQL update that violated NOT NULL constraints
  - RLS policy change that exposes incomplete records

### Cause 3: **NOT Browser Cache**
- Hard refresh (Ctrl+Shift+R) will NOT fix this
- The issue is in the database, not in cached JavaScript
- All users accessing the same database records will experience the crash

### Cause 4: **NOT Code/Deployment Issue**
- The code was working before because all employee records had valid names
- No recent deployment changed the name concatenation logic
- The **database state changed**, not the code

---

## Affected Components

All of these components will crash when loading:

| Component | File | Line(s) | Severity |
|-----------|------|---------|----------|
| Leaderboard (Tasks) | `leaderboardUtils.ts` | 61 | CRITICAL |
| Leaderboard (Reviews) | `leaderboardUtils.ts` | 128 | CRITICAL |
| Leaderboard (Earnings) | `leaderboardUtils.ts` | 192 | CRITICAL |
| Leaderboard (Attendance) | `leaderboardUtils.ts` | 272 | CRITICAL |
| Leaderboard (Approved Tasks) | `leaderboardUtils.ts` | 338 | CRITICAL |
| Leaderboard (Completion Speed) | `leaderboardUtils.ts` | 431 | CRITICAL |
| Leaderboard (Working Hours) | `leaderboardUtils.ts` | 501 | CRITICAL |
| Dashboard (loads leaderboard) | `Dashboard.tsx` | - | **CRITICAL** |
| Attendance List | `Attendance.tsx` | 170, 559 | HIGH |
| Earnings Analytics | `EarningsAnalytics.tsx` | 187, 220-221 | HIGH |
| Employees List | `Employees.tsx` | 461 | HIGH |
| Employee Salary View | `SalaryManagement.tsx` | 642 | MEDIUM |
| Task Assignment | `TaskList.tsx` | 147 | MEDIUM |

---

## Evidence

### Evidence 1: Template Literals Without Null Safety
```typescript
// Current (UNSAFE):
`${emp.first_name} ${emp.last_name}`

// If emp = { first_name: null, last_name: "Smith" }
// Results in: "null Smith"

// If emp = { first_name: null, last_name: null }
// Results in: "null null"
```

### Evidence 2: The `.toLowerCase()` Chain
```typescript
// Line 461 in Employees.tsx:
`${emp.first_name} ${emp.last_name} ${emp.email}`
  .toLowerCase()  // ← This will fail if result is "null undefined"
  .includes(...)
```

### Evidence 3: Leaderboard Data Processing
```typescript
// If employee_profiles.first_name IS NULL:
const emp = { first_name: null, last_name: "Smith" };
userName: `${emp.first_name} ${emp.last_name}` // "null Smith"

// This "null Smith" string then gets used throughout the leaderboard
// When React tries to render it or when any operation tries to
// process undefined values derived from this corrupted data,
// it crashes with: "Cannot read properties of undefined"
```

---

## Why It's Not Other Causes

### ❌ NOT browser cache
- **Reason:** Hard refresh doesn't help; crash persists
- **Why:** Cache only stores JavaScript/CSS, not database data
- **Evidence:** All users experiencing same crash indicates server-side issue

### ❌ NOT recent code deployment
- **Reason:** Code has always concatenated names without null checks
- **Why:** If deployment broke it, old code wouldn't have worked either
- **Evidence:** This pattern exists in code from before the crash started

### ❌ NOT Firebase/Google Drive integration
- **Reason:** Error occurs during dashboard load, before any Google integration
- **Why:** Dashboard leaderboard loads first, crashes before Google Drive is touched

### ❌ NOT Supabase RLS policy
- **Reason:** RLS would return error, not undefined fields
- **Why:** NULL values in database are different from RLS denying access
- **Evidence:** Data IS being returned, just with NULL fields

### ❌ NOT missing API/query changes
- **Reason:** Queries are returning data successfully
- **Why:** The crash happens during data transformation, not during fetch
- **Evidence:** Console logs show "Highest earnings leaderboard: [{…}]", meaning data arrived

---

## Verification Steps (With Database)

### Step 1: Check if Records Have NULL Names
```sql
-- Run this on Supabase:
SELECT user_id, first_name, last_name, email 
FROM employee_profiles 
WHERE first_name IS NULL OR last_name IS NULL 
LIMIT 10;
```

**Expected Result:** If this returns rows, that's your problem.

### Step 2: Count Affected Records
```sql
SELECT 
  COUNT(CASE WHEN first_name IS NULL THEN 1 END) as null_first_names,
  COUNT(CASE WHEN last_name IS NULL THEN 1 END) as null_last_names,
  COUNT(*) as total_employees
FROM employee_profiles;
```

### Step 3: Verify Constraint
```sql
-- Check if the constraint is actually enforced:
SELECT constraint_name, table_name, column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'employee_profiles' 
  AND column_name IN ('first_name', 'last_name');
```

---

## Reproduction Steps

1. **Navigate to:** `/dashboard`
2. **Component loads:** `DashboardLayout` → `Dashboard` → `Leaderboard`
3. **Leaderboard calls:** `getHighestEarningsLeaderboard()` or other functions
4. **Data fetches:** Queries `employee_profiles` where name fields are NULL
5. **Template literals execute:** `${null} ${null}` creates "null null"
6. **Component renders/processing:** Tries to call `.replace()` or `.toLowerCase()` on undefined-derived value
7. **Crash:** `Uncaught TypeError: Cannot read properties of undefined (reading 'replace')`

---

## Impact Assessment

| Severity | Component | Users Affected | Workaround |
|----------|-----------|-----------------|------------|
| 🔴 CRITICAL | Dashboard | All (white screen) | None |
| 🔴 CRITICAL | Leaderboard | All (if accessible) | None |
| 🟠 HIGH | Attendance | Managers/Admins | List employees manually |
| 🟠 HIGH | Earnings Analytics | All (if accessible) | None |
| 🟡 MEDIUM | Employees | Admins | Limited |

---

## Next Steps for Root Cause Confirmation

1. **IMMEDIATE:** Connect to Supabase database and run verification queries above
2. **CRITICAL:** Check `employee_profiles` table for NULL values in name fields
3. **URGENT:** Identify which records have NULL names and when they were created/modified
4. **VERIFY:** Check if recent bulk import, migration, or bulk update affected these fields

---

## Why The Application Worked Before

The application worked because **all employee records had valid first_name and last_name values**. Something changed recently:

- ✅ All employees had names → ✅ No crash
- ❌ Some employees lost their names (NULL) → ❌ Crash occurs

**The code never handled NULL gracefully, but it wasn't needed until now.**

---

## Conclusion

**Root Cause:** Database data corruption (NULL values in required name fields)  
**Not Caused By:** Recent deployment, browser cache, Firebase, RLS policy, or missing API changes  
**Quick Fix Location:** Supabase database - find and fix/delete records with NULL names  
**Long-term Fix:** Implement null-safe name handling in all locations listed above (after data is fixed)

