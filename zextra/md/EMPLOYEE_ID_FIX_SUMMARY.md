# Employee ID Fix Summary

## Problem
User reported that `employee_id` is not being saved in employee profiles.

## Root Causes Found

### 1. ✅ FIXED: EmployeeProfile.tsx
**Issue:** `handleSave` function was not including `employee_id` in the update query.

**Fix Applied:**
```typescript
const { error } = await supabase
  .from("employee_profiles")
  .update({
    employee_id: profile.employee_id,  // ← ADDED THIS LINE
    first_name: profile.first_name,
    // ... rest of fields
  })
```

**Status:** ✅ Fixed - employee_id will now save when editing profile

---

### 2. ❌ TODO: Employees.tsx - Create Form
**Issue:** When creating new employee, there's no field for `employee_id`.

**Current Form Fields:**
- First Name, Last Name
- Email, Password
- Role
- Designation, Seniority
- Institution, Phone

**Missing:** Employee ID input field

**Fix Needed:**
Add employee_id field to create form in `Employees.tsx`:
```typescript
<div className="space-y-2">
  <Label htmlFor="employeeId">Employee ID</Label>
  <Input
    id="employeeId"
    value={formEmployeeId}
    onChange={(e) => setFormEmployeeId(e.target.value)}
    placeholder="e.g., DPS-TCH-001"
  />
</div>
```

---

### 3. ❌ TODO: Employees.tsx - Edit Form
**Issue:** When editing employee, there's no field for `employee_id`.

**Fix Needed:**
Add employee_id field to edit form and include in update query.

---

### 4. ❌ TODO: create-user Edge Function
**Issue:** Edge function doesn't accept `employee_id` parameter.

**Current Interface:**
```typescript
interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "manager" | "employee";
  department?: string;
  designation?: string;
  seniority?: string;
  institutionAssignment?: string;
  phone?: string;
  // employee_id is MISSING
}
```

**Fix Needed:**
1. Add `employeeId?: string` to interface
2. Include in insert query:
```typescript
const { error: profileError } = await supabaseAdmin
  .from("employee_profiles")
  .insert({
    user_id: newUser.user.id,
    employee_id: employeeId,  // ← ADD THIS
    email,
    first_name: firstName,
    // ... rest
  });
```

---

## Complete Fix Checklist

- [x] **EmployeeProfile.tsx** - Add employee_id to handleSave
- [ ] **Employees.tsx** - Add employee_id field to Create form
- [ ] **Employees.tsx** - Add employee_id field to Edit form  
- [ ] **Employees.tsx** - Add formEmployeeId state
- [ ] **Employees.tsx** - Add editEmployeeId state
- [ ] **Employees.tsx** - Pass employeeId to create-user function
- [ ] **Employees.tsx** - Include employee_id in edit update query
- [ ] **create-user/index.ts** - Add employeeId to interface
- [ ] **create-user/index.ts** - Include employee_id in profile insert

---

## Testing Steps

After all fixes:

1. **Test Create:**
   - Go to Employees page
   - Click "Add Employee"
   - Fill form including Employee ID
   - Save
   - Check if employee_id is saved in database

2. **Test Edit (Admin):**
   - Go to Employees page
   - Click Edit on any employee
   - Change Employee ID
   - Save
   - Verify change in database

3. **Test Edit (Profile):**
   - Go to My Profile
   - Click "Edit Profile"
   - Change Employee ID in Personal tab
   - Save
   - Verify change persists

---

## Status

**Completed:** 1/8 fixes (12.5%)
**Remaining:** 7 fixes needed

**Next Action:** Fix Employees.tsx create and edit forms, then update edge function.

---

**Created:** May 15, 2026
**Issue:** Employee ID not saving
**Priority:** High
