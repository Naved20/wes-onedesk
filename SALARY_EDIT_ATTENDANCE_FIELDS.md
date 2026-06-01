# Salary Edit - Attendance Fields Update

## Overview
Salary edit dialog में अब **Late Sets (LS)** और **Sick Leave (LE)** fields भी add हो गए हैं, जो बाकी attendance fields की तरह काम करते हैं।

---

## Attendance Fields in Salary Edit

### Row 1: Main Attendance Fields
```
[Payroll Days] [Present (PR)] [Half Day (HD)] [Paid Leave (PL)]
```

### Row 2: Deduction Fields
```
[Absent (AB)] [Holidays (HO)] [Late Days (LT)] [Late Sets (LS)]
```

### Row 3: Leave Field
```
[Sick Leave (LE)]
```

---

## Field Details

### 1. **Payroll Days**
- **Type:** Read-only (disabled)
- **Value:** Total days in month (e.g., 31 for May)
- **Editable:** No
- **Color:** Blue

### 2. **Present (PR)**
- **Type:** Editable number input
- **Value:** Days employee was present
- **Editable:** Yes (when editing enabled)
- **Color:** Green

### 3. **Half Day (HD)**
- **Type:** Editable number input
- **Value:** Half days worked
- **Editable:** Yes (when editing enabled)
- **Color:** Orange

### 4. **Paid Leave (PL)**
- **Type:** Editable number input
- **Value:** Paid leave days taken
- **Editable:** Yes (when editing enabled)
- **Color:** Blue

### 5. **Absent (AB)**
- **Type:** Editable number input
- **Value:** Days absent
- **Editable:** Yes (when editing enabled)
- **Color:** Red

### 6. **Holidays (HO)**
- **Type:** Read-only (disabled)
- **Value:** Auto-calculated from attendance records
- **Editable:** No
- **Color:** Purple

### 7. **Late Days (LT)** ✨ NEW
- **Type:** Editable number input
- **Value:** Number of late check-ins
- **Editable:** Yes (when editing enabled)
- **Color:** Yellow
- **Note:** Used to calculate Late Sets

### 8. **Late Sets (LS)** ✨ NEW
- **Type:** Read-only (disabled)
- **Value:** Auto-calculated from Late Days
- **Formula:** `Math.floor(Late Days ÷ 3)`
- **Editable:** No
- **Color:** Yellow (darker)
- **Note:** 3 late days = 1 late set

### 9. **Sick Leave (LE)** ✨ NEW
- **Type:** Editable number input
- **Value:** Sick leave days taken
- **Editable:** Yes (when editing enabled)
- **Color:** Pink
- **Note:** Deducted from total paid days

---

## How It Works

### When Editing is Disabled (Read-only):
```
All fields show as text values with color coding
Payroll Days: 31
Present (PR): 14
Half Day (HD): 0
Paid Leave (PL): 0
Absent (AB): 6
Holidays (HO): 11
Late Days (LT): 3
Late Sets (LS): 1
Sick Leave (LE): 0
```

### When Editing is Enabled:
```
Editable fields: Input boxes
Read-only fields: Disabled input boxes (grayed out)

Editable:
- Present (PR): [Input box]
- Half Day (HD): [Input box]
- Paid Leave (PL): [Input box]
- Absent (AB): [Input box]
- Late Days (LT): [Input box] ← Change this
- Sick Leave (LE): [Input box]

Auto-calculated:
- Payroll Days: [Disabled]
- Holidays (HO): [Disabled]
- Late Sets (LS): [Disabled] ← Auto-updates when Late Days change
```

---

## Formulas

### Late Sets Calculation:
```
Late Sets = Math.floor(Late Days ÷ 3)

Example:
- 0-2 late days = 0 late sets
- 3-5 late days = 1 late set
- 6-8 late days = 2 late sets
- 9+ late days = 3+ late sets
```

### Total Paid Days Calculation:
```
Total Paid Days = 
  PR (Present Days) +
  HO (Holiday Count) +
  (HD × 0.5) (Half Days × 0.5) +
  PL (Paid Leave Days) -
  LS (Late Sets) -
  (AB × 2) (Absent Days × 2) -
  LE (Sick Leaves)
```

---

## Example

### Scenario:
```
Payroll Days: 31
Present Days: 14
Half Days: 0
Paid Leave Days: 0
Absent Days: 6
Holiday Count: 11
Late Days: 3
Sick Leaves: 0
```

### Calculation:
```
1. Late Sets = Math.floor(3 ÷ 3) = 1
2. Total Paid Days = 14 + 11 + (0 × 0.5) + 0 - 1 - (6 × 2) - 0
                   = 14 + 11 + 0 + 0 - 1 - 12 - 0
                   = 12 days
```

---

## How to Edit

### Step 1: Open Salary Edit Dialog
- Click edit button on salary record

### Step 2: Enable Attendance Editing
- Click "Enable Editing" button in Attendance Summary section

### Step 3: Edit Fields
- **Editable fields:** Click and change values
  - Present (PR)
  - Half Day (HD)
  - Paid Leave (PL)
  - Absent (AB)
  - Late Days (LT) ← Change this to update Late Sets
  - Sick Leave (LE)

- **Auto-calculated fields:** Cannot edit
  - Payroll Days (fixed)
  - Holidays (HO) (auto-calculated)
  - Late Sets (LS) (auto-calculated from Late Days)

### Step 4: Save Changes
- Click "Save Attendance" button
- Salary will be recalculated automatically

---

## Data Flow

```
User edits Late Days (LT)
    ↓
Late Sets (LS) auto-updates: Math.floor(Late Days ÷ 3)
    ↓
Total Paid Days recalculates
    ↓
Salary recalculates
    ↓
Click "Save Attendance"
    ↓
Updates salaries table
```

---

## Color Coding

| Field | Color | Meaning |
|-------|-------|---------|
| Payroll Days | Blue | Fixed (total days in month) |
| Present (PR) | Green | Editable |
| Half Day (HD) | Orange | Editable |
| Paid Leave (PL) | Blue | Editable |
| Absent (AB) | Red | Editable |
| Holidays (HO) | Purple | Auto-calculated |
| Late Days (LT) | Yellow | Editable |
| Late Sets (LS) | Yellow (darker) | Auto-calculated |
| Sick Leave (LE) | Pink | Editable |

---

## Benefits

✅ **Complete Attendance Control** - All attendance fields editable
✅ **Auto-calculation** - Late Sets auto-updates from Late Days
✅ **Clear Indicators** - Read-only fields are disabled/grayed out
✅ **Formula Transparency** - Shows calculation formula
✅ **Consistent UI** - Same as other attendance fields
✅ **Data Integrity** - Auto-calculated fields cannot be manually edited

---

## Summary

| Field | Type | Editable | Auto-calculated |
|-------|------|----------|-----------------|
| Payroll Days | Fixed | No | No |
| Present (PR) | Input | Yes | No |
| Half Day (HD) | Input | Yes | No |
| Paid Leave (PL) | Input | Yes | No |
| Absent (AB) | Input | Yes | No |
| Holidays (HO) | Calculated | No | Yes |
| Late Days (LT) | Input | Yes | No |
| Late Sets (LS) | Calculated | No | Yes |
| Sick Leave (LE) | Input | Yes | No |

अब salary edit में **Late Sets (LS)** और **Sick Leave (LE)** भी दिखते हैं और बाकी fields की तरह काम करते हैं! 🎉

