# Quick Reference - Salary & Attendance Sync ⚡

## 🎯 क्या बदला (What Changed)

### File Modified:
- `src/components/salary/SalaryManagement.tsx` - `recalculateAllSalaries()` function

### Changes Made:

| Feature | पहले (Before) | अब (Now) |
|---------|:---:|:---:|
| Attendance Summary Update | ❌ सिर्फ unlocked | ✅ सभी employees के लिए |
| Locked Salary Protection | ⚠️ Manual check | ✅ Automatic skip |
| Error Tracking | Combined count | ✅ Separate counts |
| Result Message | Generic | ✅ Detailed breakdown |

---

## 🔄 How It Works Now

### Step 1️⃣ - Update Attendance Summary
```
Jab "Recalculate All Salaries" पर click करो:
│
├─ Fetch attendance data for ALL employees
├─ Calculate summary using RPC
├─ Check both holidays sources (deduplicate)
├─ Update attendance_summary table
│  ├─ present_days ✓
│  ├─ half_days ✓
│  ├─ paid_leave_days ✓
│  ├─ absent_days ✓
│  ├─ late_days ✓
│  ├─ holiday_count ✓
│  └─ etc...
└─ Result: ✅ 45 updated | ❌ 3 errors
```

### Step 2️⃣ - Recalculate Only Unlocked Salaries
```
For each UNLOCKED salary:
│
├─ Double-check: is_locked == false?
├─ Fetch attendance_summary (fresh data)
├─ Fetch salary_structure
├─ Calculate using NEW FORMULA:
│  ├─ Per Day Rate = Fixed Gross / Days in Month
│  ├─ Late Sets = Floor(Late Days / 3)
│  ├─ Paid Units = Present + Holiday + (HalfDay×0.5) + Leave - LS - Absent
│  ├─ Gross = Per Day Rate × Paid Units
│  ├─ Components: Basic, HRA, Allowances
│  ├─ Deductions: EPF, ESIC, TDS, etc.
│  └─ Final Net & CTC
├─ Update database
└─ Count success

For LOCKED salaries:
└─ SKIP ❌ (don't touch them)
```

### Step 3️⃣ - Show Results
```
Toast Message:
✓ Attendance: 45 updated | Salary: 40 recalculated, 5 locked, 0 errors
```

---

## 🛡️ Locked Salary Protection

```typescript
// यह check करता है कि salary locked है या नहीं
if (salary.is_locked) {
  console.log(`Skipping locked salary`);
  salarySkippedCount++;
  continue; // यह salary को छोड़ देता है
}

// अगर continue हो गया, तो recalculation नहीं होगी
```

### Result:
- ✅ Locked salaries **completely safe** - कोई भी change नहीं
- ✅ Admin को पता चल जाता है कितने skip हुए
- ✅ Clear audit trail

---

## 📋 Function Breakdown

### recalculateAllSalaries()
```typescript
Main Entry Point - Admins only

Step 1: Update Attendance Summary
├─ For: ALL employees
├─ Do: Fetch → Calculate → Save
└─ Track: attendanceSummarySuccessCount, attendanceSummaryErrorCount

Step 2: Recalculate Salaries
├─ For: ONLY unlocked salaries
├─ Do: Fetch → Calculate → Update
└─ Track: salarySuccessCount, salaryErrorCount, salarySkippedCount

Step 3: Show Results
└─ Toast with detailed breakdown
```

### calculateAttendanceSummary()
```
Attendance data को month के लिए aggregate करता है
├─ Uses: RPC (calculate_attendance_stats)
├─ Handles: Holiday deduplication
├─ Returns: {presentDays, halfDays, paidLeaveDays, ...}
└─ Called by: recalculateAllSalaries()
```

### saveAttendanceSummaryForEmployee()
```
attendance_summary table में save करता है
├─ UPSERT (Create या Update)
├─ Calculates: late_sets, total_paid_days, attendance_percentage
└─ Runs for: Every employee (locked या unlocked)
```

---

## ✅ Testing (Verify करने के लिए)

```bash
# 1. Build करो
npm run build

# 2. Linting check करो
npm run lint

# 3. Admin login करो
# 4. जाओ: Salaries page
# 5. Click करो: "Recalculate All Salaries" button
# 6. Check करो:
#    ✓ Toast message दिख रहा है?
#    ✓ Attendance summary updated हो रहा है?
#    ✓ Locked salaries skip हो रहीं हैं?
#    ✓ Unlocked salaries recalculate हो रहीं हैं?
#    ✓ Numbers correct हैं?
```

---

## 📊 Formula Quick Reference

```
Per Day Rate = Fixed Gross / Days in Month
Paid Days = PR + HO + (HD×0.5) + PL - LS - AB
Gross Earned = Per Day Rate × Paid Days
Net = Gross - (EPF + ESIC + TDS + ...)
CTC = Net + Employer Contribution
```

---

## 🚀 Key Benefits

1. **✅ Automatic Sync**: Attendance changes → Salary updates
2. **✅ Data Consistency**: Attendance summary हमेशा fresh
3. **✅ Locked Protection**: कोई भी locked salary change नहीं हो सकती
4. **✅ Error Tracking**: Clear breakdown of what happened
5. **✅ Audit Trail**: कौन से salaries skip हुए, पता चलता है

---

## ⚠️ Important Notes

- 🔒 **Locked salaries को unlock करने के लिए admin permission चाहिए**
- 📝 **Attendance data सभी employees के लिए update होती है** (locked/unlocked दोनों)
- 🎯 **सिर्फ salary recalculation में locked check लागू है**
- 📊 **Holiday deduplication दोनों sources से करता है** (holidays table + attendance table)

---

*Last Updated: June 3, 2026*
*Language: Hinglish as requested* 🎯
