# Flow Diagram - Salary Recalculation Process 📊

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Admin clicks "Recalculate All Salaries" Button             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Admin Permission Check │
        └────────────┬───────────┘
                     │
              ✅ Yes │ ❌ No
                     │  └─► Show Error
                     │
                     ▼
        ┌─────────────────────────────────────────┐
        │ Filter Unlocked Salaries                │
        │ unlockedSalaries = filter(!is_locked)  │
        └────────────┬────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STEP 1: Update Attendance Summary for ALL Employees    │
   └────────────────┬──────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   Employee 1              Employee 2...
   ├─ Fetch attendance    ├─ Fetch attendance
   │  (01-30 Jun)        │  (01-30 Jun)
   │                     │
   ├─ Calculate          ├─ Calculate
   │  (using RPC)        │  (using RPC)
   │                     │
   ├─ Get summary:       ├─ Get summary:
   │  ├─ present: 25     │  ├─ present: 22
   │  ├─ absent: 2       │  ├─ absent: 3
   │  ├─ half_day: 1     │  ├─ half_day: 2
   │  ├─ paid_leave: 1   │  ├─ paid_leave: 1
   │  ├─ holiday: 3      │  ├─ holiday: 3
   │  ├─ late: 0         │  ├─ late: 1
   │  └─ ...             │  └─ ...
   │                     │
   ├─ UPSERT to          ├─ UPSERT to
   │  attendance_summary │  attendance_summary
   │                     │
   └─ ✅ Count++         └─ ✅ Count++
   
   Result: attendanceSummarySuccessCount = 45 ✅
           attendanceSummaryErrorCount = 0 ❌
   
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1 LOG: "Step 1 Complete: 45 updated, 0 errors"    │
        └────────────┬──────────────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ STEP 2: Recalculate ONLY Unlocked Salaries                 │
   └────────────┬──────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼ (Unlocked)            ▼ (Unlocked)      (Locked) ──┐
Employee 1              Employee 2...                     │
├─ is_locked? NO        ├─ is_locked? NO                  │
│                       │                                │
├─ Fetch latest         ├─ Fetch latest                 │
│  attendance_summary   │  attendance_summary           │
│                       │                                │
├─ Fetch salary         ├─ Fetch salary                 │
│  structure            │  structure                    │
│                       │                                │
├─ Calculate Salary:    ├─ Calculate Salary:           │
│  ├─ Per Day Rate      │  ├─ Per Day Rate             │
│  ├─ Late Sets         │  ├─ Late Sets                │
│  ├─ Paid Day Units    │  ├─ Paid Day Units           │
│  ├─ Gross Earned      │  ├─ Gross Earned             │
│  ├─ Components        │  ├─ Components               │
│  ├─ Deductions        │  ├─ Deductions               │
│  └─ Final Net & CTC   │  └─ Final Net & CTC          │
│                       │                               │
├─ Update salary        ├─ Update salary               │
│  record               │  record                      │
│                       │                               │
└─ ✅ Count++           └─ ✅ Count++           (Skip)
                                                └─ 🔒 Count++

   Result: salarySuccessCount = 40 ✅
           salaryErrorCount = 0 ❌
           salarySkippedCount = 5 🔒
   
        ┌──────────────────────────────────────────────────────────┐
        │ STEP 2 LOG: "Step 2: 40 updated, 5 locked, 0 errors"    │
        └────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────────────┐
        │ Show Toast Message                        │
        │ "✓ Attendance: 45 updated |              │
        │  Salary: 40 recalculated, 5 locked,     │
        │  0 errors"                               │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────────────────────┐
        │ Refresh Data on UI                        │
        │ fetchData()                               │
        └───────────────────────────────────────────┘
```

---

## Detailed Step 1 - Attendance Summary Update

```
For Each Employee (ALL, including locked ones):
│
├─ 1. Fetch Attendance Records
│    FROM attendance table
│    WHERE user_id = $1
│    AND date BETWEEN month_start AND month_end
│    └─ Result: Array of attendance records
│
├─ 2. Call RPC: calculate_attendance_stats
│    WITH:
│    ├─ p_user_id
│    ├─ p_year
│    └─ p_month
│    └─ Result: {present, absent, half, late, leave, ...}
│
├─ 3. Deduplicate Holidays (2 sources)
│    ├─ Source 1: holidays table
│    │  SELECT date FROM holidays
│    │  WHERE date BETWEEN month_start AND month_end
│    │
│    └─ Source 2: attendance table
│       SELECT date FROM attendance
│       WHERE calculated_status = 'holiday'
│       AND date BETWEEN month_start AND month_end
│
│    Combine both sources, remove duplicates
│    └─ Result: Set of unique holiday dates
│
├─ 4. Calculate holiday_count
│    holiday_count = total_holidays - holidays_where_worked
│
├─ 5. Calculate late_sets
│    late_sets = FLOOR(late_days / 3)
│
├─ 6. Calculate total_paid_days
│    total_paid_days = present + holiday
│                     + (half_days × 0.5)
│                     + paid_leave
│                     - late_sets
│                     - absent
│
├─ 7. Calculate attendance_percentage
│    attendance_percentage = (total_paid_days / payroll_days) × 100
│
└─ 8. UPSERT to attendance_summary
     INSERT OR UPDATE attendance_summary
     WHERE user_id = $1, year = $2, month = $3
     SET:
     ├─ present_days = $present
     ├─ half_days = $half
     ├─ holiday_count = $holiday_count
     ├─ paid_leave_days = $paid_leave
     ├─ leave_days = $sick_leave
     ├─ absent_days = $absent
     ├─ late_days = $late
     ├─ late_sets = $late_sets
     ├─ total_paid_days = $total_paid_days
     ├─ attendance_percentage = $att_percentage
     └─ updated_at = NOW()
     └─ Success ✅ or Error ❌
```

---

## Detailed Step 2 - Salary Recalculation (Only Unlocked)

```
For Each UNLOCKED Salary Record:
│
├─ 1. Safety Check
│    IF salary.is_locked == true THEN
│    │   Skip to next ❌
│    │   Count: salarySkippedCount++
│    └─ ELSE continue
│
├─ 2. Fetch Latest Attendance Summary
│    SELECT * FROM attendance_summary
│    WHERE user_id = salary.user_id
│    AND year = selectedYear
│    AND month = selectedMonth
│    └─ Get fresh data
│
├─ 3. Fetch Salary Structure
│    SELECT * FROM salary_structures
│    WHERE user_id = salary.user_id
│    AND is_active = true
│    └─ Get configuration (percentages, EPF, ESIC, etc)
│
├─ 4. Calculate Base Values
│    payroll_days = Days_In_Month
│    per_day_rate = fixed_gross_salary / payroll_days
│
├─ 5. Calculate Paid Day Units
│    late_sets = FLOOR(late_days / 3)
│    paid_day_units = present
│                   + holiday_count
│                   + (half_days × 0.5)
│                   + paid_leave_days
│                   - late_sets
│                   - absent_days
│
├─ 6. Calculate Gross Earned
│    gross_earned = per_day_rate × paid_day_units
│
├─ 7. Calculate Fixed Components
│    basic_earned = gross_earned × (basic_percentage / 100)
│    hra_earned = basic_earned × (hra_percentage / 100)
│    other_allowance = gross_earned × (other_allowance_pct / 100)
│
├─ 8. Add Variable Earnings
│    total_variable = SUM(variable_earnings)
│    total_gross = gross_earned + total_variable
│
├─ 9. Calculate Employee Deductions
│    epf_employee = (epf_applicable)
│                   ? (basic_earned × epf_rate / 100)
│                   : 0
│    esic_employee = (esic_applicable)
│                    ? (total_gross × esic_rate / 100)
│                    : 0
│    total_deductions = epf + esic + tds + prof_tax
│                     + manual_deduction + other_deductions
│
├─ 10. Calculate Net Payable
│     net_payable = total_gross - total_deductions
│
├─ 11. Calculate Employer Contributions
│      epf_employer = (epf_applicable)
│                     ? (basic_earned × epf_rate / 100)
│                     : 0
│      esic_employer = (esic_applicable)
│                      ? (total_gross × 3.25 / 100)
│                      : 0
│      total_employer = epf_employer + esic_employer
│
├─ 12. Calculate CTC
│      total_ctc = net_payable + total_employer
│
└─ 13. UPDATE Salary Record
      UPDATE salaries SET
      ├─ working_days = $working_days
      ├─ present_days = $present
      ├─ absent_days = $absent
      ├─ half_days = $half
      ├─ paid_leave_days = $paid_leave
      ├─ late_days = $late
      ├─ holiday_count = $holiday
      ├─ sick_leaves = $sick_leave
      ├─ per_day_salary = $per_day_rate
      ├─ basic_earned = $basic_earned
      ├─ hra_earned = $hra_earned
      ├─ other_allowance_earned = $other_allowance
      ├─ variable_earnings_total = $total_variable
      ├─ gross_salary = $total_gross
      ├─ epf_employee = $epf_employee
      ├─ esic_employee = $esic_employee
      ├─ total_deductions = $total_deductions
      ├─ net_salary_calculated = $net_payable
      ├─ final_salary = $final_salary
      ├─ epf_employer = $epf_employer
      ├─ esic_employer = $esic_employer
      ├─ total_employer_contribution = $total_employer
      ├─ total_ctc = $total_ctc
      ├─ updated_at = NOW()
      WHERE id = salary.id
      └─ Success ✅ or Error ❌
```

---

## Data Transformation

```
Attendance Records (Raw)
       │
       ├─ 2024-06-01: present
       ├─ 2024-06-02: absent
       ├─ 2024-06-03: present
       ├─ 2024-06-04: holiday
       ├─ 2024-06-05: half_day
       ├─ 2024-06-06: paid_leave
       ├─ 2024-06-07: present
       ├─ 2024-06-08: late (present)
       └─ ... (20+ more records)
       │
       ▼ (RPC Calculation + Manual Processing)
       │
Attendance Summary (Aggregated)
       │
       ├─ present_days: 25
       ├─ absent_days: 2
       ├─ half_days: 1
       ├─ paid_leave_days: 1
       ├─ late_days: 1
       ├─ holiday_count: 3
       ├─ sick_leaves: 0
       ├─ late_sets: 0
       ├─ total_paid_days: 29.5
       └─ attendance_percentage: 98.33%
       │
       ▼ (Salary Formula)
       │
Salary Record (Calculated)
       │
       ├─ per_day_rate: ₹1,000
       ├─ gross_earned: ₹29,500
       ├─ basic_earned: ₹14,750
       ├─ hra_earned: ₹5,900
       ├─ other_allowance: ₹8,850
       ├─ total_gross: ₹29,500
       ├─ epf_deduction: ₹1,770
       ├─ esic_deduction: ₹220
       ├─ total_deductions: ₹1,990
       ├─ net_salary_calculated: ₹27,510
       ├─ epf_employer: ₹1,770
       ├─ esic_employer: ₹960
       ├─ total_ctc: ₹30,240
       └─ final_salary: ₹27,510
```

---

## Error Handling Flow

```
Try to Update Attendance Summary
│
├─ Success? ✅
│  └─ attendanceSummarySuccessCount++
│
└─ Error? ❌
   ├─ Log error
   ├─ attendanceSummaryErrorCount++
   └─ Continue to next employee

Try to Update Salary
│
├─ Locked? 🔒
│  ├─ salarySkippedCount++
│  └─ Continue to next
│
├─ Success? ✅
│  └─ salarySuccessCount++
│
└─ Error? ❌
   ├─ Log error
   ├─ salaryErrorCount++
   └─ Continue to next

Final Toast:
"✓ Attendance: {success} updated | 
 Salary: {success} recalculated, {skipped} locked, {errors} errors"
```

---

*Diagram Created: June 3, 2026*
*For detailed code, see: SALARY_ATTENDANCE_SYNC_IMPROVEMENTS.md*
