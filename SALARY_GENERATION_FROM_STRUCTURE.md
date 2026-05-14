# Salary Generation from Salary Structure ✅

**Date:** May 15, 2026  
**Migration:** `20260515000004_update_salary_generation_use_structure.sql`  
**Status:** Ready to Run

---

## 🎯 WHAT CHANGED

### ❌ BEFORE (Old Logic)

```sql
-- Used employee_profiles.base_salary
SELECT base_salary FROM employee_profiles

-- Fixed calculations
HRA = base_salary * 0.40 (40%)
PF = base_salary * 0.12 (12%)
Travel = 1600 (fixed)
Professional Tax = 200 (fixed)
```

**Problems:**
- ❌ Ignored salary_structures table
- ❌ Fixed percentages (not configurable)
- ❌ No attendance-based calculation
- ❌ Hardcoded values

### ✅ AFTER (New Logic)

```sql
-- Uses salary_structures table
SELECT * FROM salary_structures WHERE is_active = true

-- Dynamic calculations based on structure
Basic = (Per Day × Days) × basic_percentage
HRA = Basic × hra_percentage
EPF = Basic × 12% (if epf_applicable)
ESIC = Gross × 0.75% (if esic_applicable)
```

**Benefits:**
- ✅ Uses configured salary structure
- ✅ Respects percentages from setup
- ✅ Attendance-based calculation
- ✅ EPF/ESIC toggles respected

---

## 🔧 HOW IT WORKS

### Step 1: Get Salary Structure
```sql
SELECT * FROM salary_structures
WHERE user_id = employee_id
  AND is_active = true
```

**Fields Used:**
- `fixed_gross_salary` - Monthly salary
- `basic_percentage` - Basic % (default 50%)
- `hra_percentage` - HRA % of Basic (default 40%)
- `epf_applicable` - EPF toggle
- `esic_applicable` - ESIC toggle

### Step 2: Get Attendance Data
```sql
v_attendance_stats := calculate_attendance_stats(user_id, year, month);
```

**Returns:**
- `present_days` - Full days present
- `half_days` - Half days (counted as 0.5)
- `casual_leaves` - Paid leaves

**Calculation:**
```javascript
Effective Days = present_days + (half_days × 0.5) + paid_leave_days
```

### Step 3: Calculate Per Day Salary
```javascript
Per Day Salary = Fixed Gross Salary ÷ Working Days
```

**Example:**
```
Fixed Gross: ₹10,000
Working Days: 26
Per Day: ₹384.62
```

### Step 4: Calculate Earned Amounts
```javascript
// Based on actual attendance
Basic Earned = Per Day × Effective Days × (Basic % ÷ 100)
HRA Earned = Basic Earned × (HRA % ÷ 100)
Other Earned = (Per Day × Effective Days) - Basic - HRA
```

**Example:**
```
Per Day: ₹384.62
Effective Days: 25 (24 present + 1 paid leave)
Basic %: 50%
HRA %: 40%

Basic Earned = ₹384.62 × 25 × 0.50 = ₹4,807.75
HRA Earned = ₹4,807.75 × 0.40 = ₹1,923.10
Other Earned = (₹384.62 × 25) - ₹4,807.75 - ₹1,923.10 = ₹2,884.65
```

### Step 5: Calculate Gross Salary
```javascript
Gross Salary = Basic Earned + HRA Earned + Other Earned
```

### Step 6: Calculate Deductions
```javascript
// EPF (if applicable)
EPF Employee = Basic Earned × 12%

// ESIC (if applicable)
ESIC Employee = Gross Salary × 0.75%

Total Deductions = EPF + ESIC
```

**Example:**
```
Basic Earned: ₹4,807.75
Gross Salary: ₹9,615.50

EPF (if enabled): ₹4,807.75 × 0.12 = ₹576.93
ESIC (if enabled): ₹9,615.50 × 0.0075 = ₹72.12

Total Deductions: ₹649.05
```

### Step 7: Calculate Net Salary
```javascript
Net Salary = Gross Salary - Total Deductions
```

**Example:**
```
Gross: ₹9,615.50
Deductions: ₹649.05
Net: ₹8,966.45
```

---

## 📊 COMPLETE EXAMPLE

### Scenario: Abdul Waseem - May 2026

#### Salary Structure (Configured):
```
Fixed Gross Salary: ₹10,000
Basic %: 50%
HRA %: 40% (of Basic)
EPF Applicable: Yes
ESIC Applicable: Yes
```

#### Attendance (May 2026):
```
Working Days: 26
Present Days: 24
Half Days: 0
Paid Leave: 1
Absent: 1
```

#### Calculations:

**1. Per Day Salary:**
```
₹10,000 ÷ 26 = ₹384.62
```

**2. Effective Days:**
```
24 + 0 + 1 = 25 days
```

**3. Earned Amounts:**
```
Basic Earned = ₹384.62 × 25 × 0.50 = ₹4,807.75
HRA Earned = ₹4,807.75 × 0.40 = ₹1,923.10
Other Earned = (₹384.62 × 25) - ₹4,807.75 - ₹1,923.10 = ₹2,884.65
```

**4. Gross Salary:**
```
₹4,807.75 + ₹1,923.10 + ₹2,884.65 = ₹9,615.50
```

**5. Deductions:**
```
EPF Employee: ₹4,807.75 × 0.12 = ₹576.93
ESIC Employee: ₹9,615.50 × 0.0075 = ₹72.12
Total: ₹649.05
```

**6. Net Salary:**
```
₹9,615.50 - ₹649.05 = ₹8,966.45
```

#### Salary Record Created:
```json
{
  "user_id": "abdul_id",
  "month": 5,
  "year": 2026,
  "base_salary": 10000,
  "working_days": 26,
  "present_days": 25,
  "paid_leave_days": 1,
  "absent_days": 1,
  "per_day_salary": 384.62,
  "hra_amount": 1923.10,
  "pf_deduction": 576.93,
  "gross_salary": 9615.50,
  "net_salary_calculated": 8966.45,
  "final_salary": 8966.45,
  "approval_status": "draft",
  "is_locked": false
}
```

---

## 🎯 KEY FEATURES

### 1. **Attendance-Based Calculation**
- ✅ Only pays for days worked
- ✅ Includes paid leaves
- ✅ Handles half days
- ✅ Deducts absent days

### 2. **Structure-Based Percentages**
- ✅ Uses configured Basic %
- ✅ Uses configured HRA %
- ✅ Respects EPF/ESIC toggles
- ✅ No hardcoded values

### 3. **Accurate Deductions**
- ✅ EPF on Basic only
- ✅ ESIC on Gross
- ✅ Only if applicable
- ✅ Correct percentages

### 4. **Flexible System**
- ✅ Different structures per employee
- ✅ Easy to modify percentages
- ✅ No code changes needed
- ✅ Database-driven

---

## 🚨 IMPORTANT NOTES

### 1. **Salary Structure Required**
```
If employee has NO salary structure:
→ Salary record will NOT be created
→ Will be counted in "skipped"
```

**Solution:** Configure salary structure first!

### 2. **Active Structure Only**
```
Only uses structures where:
is_active = true
```

**Multiple structures:** Uses the first active one

### 3. **Attendance Data**
```
Uses calculate_attendance_stats() function
Must have attendance records for accurate calculation
```

### 4. **Manual Adjustments**
```
After generation, admin can manually add:
- Travel Allowance
- Special Bonus
- TDS Deduction
- Professional Tax
- Other Deductions
```

---

## 📋 MIGRATION STEPS

### Step 1: Run Migration
```bash
# Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/glijytescdhdtihzlhlg/sql/new
2. Copy: supabase/migrations/20260515000004_update_salary_generation_use_structure.sql
3. Paste and Run
```

### Step 2: Verify Function
```sql
-- Check function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'generate_monthly_salaries';
```

### Step 3: Test Generation
```sql
-- Generate salaries for May 2026
SELECT generate_monthly_salaries(2026, 5);
```

**Expected Response:**
```json
{
  "success": true,
  "created": 15,
  "skipped": 16,
  "working_days": 26,
  "message": "Salary records generated from salary structures"
}
```

### Step 4: Verify Records
```sql
-- Check created records
SELECT 
  ep.first_name,
  ep.last_name,
  s.base_salary,
  s.working_days,
  s.present_days,
  s.gross_salary,
  s.net_salary_calculated
FROM salaries s
JOIN employee_profiles ep ON s.user_id = ep.user_id
WHERE s.month = 5 AND s.year = 2026;
```

---

## ✅ VERIFICATION CHECKLIST

Before using in production:

- [ ] Migration run successfully
- [ ] Function exists in database
- [ ] Salary structures configured for employees
- [ ] Attendance data available
- [ ] Test generation works
- [ ] Calculations are correct
- [ ] EPF/ESIC toggles respected
- [ ] Manual adjustments possible

---

## 🔄 WORKFLOW

### Complete Salary Process:

```
1. Configure Salary Structure
   ↓
2. Mark Attendance Daily
   ↓
3. Generate Monthly Salaries (auto-calculates)
   ↓
4. Review & Adjust (if needed)
   ↓
5. Approve Salaries
   ↓
6. Lock Salaries
   ↓
7. Process Payment
```

---

## 💡 BENEFITS

### For Admins:
- ✅ **Accurate calculations** - Based on actual attendance
- ✅ **No manual work** - Auto-generates from structure
- ✅ **Flexible** - Different structures per employee
- ✅ **Transparent** - All calculations visible

### For Employees:
- ✅ **Fair pay** - Only for days worked
- ✅ **Paid leaves** - Counted in salary
- ✅ **Clear breakdown** - See all components
- ✅ **Consistent** - Same formula every month

### For System:
- ✅ **Maintainable** - No hardcoded values
- ✅ **Scalable** - Works for any number of employees
- ✅ **Auditable** - All data in database
- ✅ **Flexible** - Easy to modify logic

---

## 🎯 COMPARISON

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Data Source** | employee_profiles.base_salary | salary_structures table |
| **Percentages** | Hardcoded (40%, 12%) | Configurable per employee |
| **Attendance** | ❌ Not considered | ✅ Fully integrated |
| **EPF/ESIC** | Always applied | Toggle-based |
| **Flexibility** | Low | High |
| **Accuracy** | Approximate | Precise |
| **Maintenance** | Code changes needed | Database updates only |

---

## 📞 TROUBLESHOOTING

### Problem: No salaries generated
**Check:**
1. Are salary structures configured?
2. Are they marked as `is_active = true`?
3. Are employees marked as `is_active = true`?

### Problem: Wrong calculations
**Check:**
1. Salary structure percentages correct?
2. Attendance data available?
3. Working days calculated correctly?

### Problem: Missing deductions
**Check:**
1. EPF/ESIC toggles enabled in structure?
2. Percentages correct (12%, 0.75%)?

---

**Created:** May 15, 2026  
**Migration:** Ready to Run  
**Status:** ✅ Complete  
**Impact:** High - Changes salary generation logic
