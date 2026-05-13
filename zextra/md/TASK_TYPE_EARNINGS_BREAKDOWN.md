# Task Type & Earnings Breakdown Feature

## What Changed?

Employee dashboard ab **type-wise earnings breakdown** dikhata hai:

### Task Types:
1. **English Reading, listening & speaking Task** → Display: "English Reading"
2. **Lesson Plan & Delivery** → Display: "Lesson Plan"  
3. **Soft & Digital Skills** → Display: "Soft & Digital"

### Before (Old):
- ✅ Total Earnings: Single card with total amount
- ❌ No type-wise breakdown
- ❌ No way to see earnings per task type

### After (New):
- ✅ **Total Earnings Card**: Shows overall earnings
- ✅ **Earnings by Type Card**: Shows breakdown by 3 task types
- ✅ **Filter by Type**: Dropdown to filter tasks by type
- ✅ **Separate counts**: Each type shows its own earning amount

---

## Features Added

### 1. **Earnings by Type Card**
New card displays earnings breakdown:
```
Earnings by Type
├── English Reading: ₹XXX.XX
├── Lesson Plan: ₹XXX.XX
└── Soft & Digital: ₹XXX.XX
```

### 2. **Type Filter**
Dropdown filter with options:
- All Types
- English Reading
- Lesson Plan
- Soft & Digital

### 3. **Responsive Layout**
- Desktop: 2 cards side by side (Total + By Type)
- Mobile: Stacked vertically

---

## How It Works

### Data Flow:

1. **Fetch Earnings**:
   ```typescript
   // Fetch earnings with task type
   SELECT amount, status, task_id, tasks.type
   FROM task_earnings
   WHERE user_id = current_user
   ```

2. **Calculate by Type**:
   ```typescript
   const byType = {};
   earnings.forEach(earning => {
     const type = earning.tasks.type;
     byType[type] = (byType[type] || 0) + earning.amount;
   });
   ```

3. **Display**:
   - Total Earnings: Sum of all types
   - By Type: Individual amounts per type

### State Management:
```typescript
const [totalEarnings, setTotalEarnings] = useState<number>(0);
const [earningsByType, setEarningsByType] = useState<Record<string, number>>({});
```

---

## UI Layout

### Desktop View:
```
┌─────────────────────────────┬─────────────────────────────┐
│   Total Earnings            │   Earnings by Type          │
│   ₹XXX.XX                   │   English Reading: ₹XX.XX   │
│   [Refresh]                 │   Lesson Plan: ₹XX.XX       │
│                             │   Soft & Digital: ₹XX.XX    │
└─────────────────────────────┴─────────────────────────────┘
```

### Mobile View:
```
┌─────────────────────────────┐
│   Total Earnings            │
│   ₹XXX.XX                   │
│   [Refresh]                 │
└─────────────────────────────┘
┌─────────────────────────────┐
│   Earnings by Type          │
│   English Reading: ₹XX.XX   │
│   Lesson Plan: ₹XX.XX       │
│   Soft & Digital: ₹XX.XX    │
└─────────────────────────────┘
```

---

## Color Scheme

### Total Earnings Card:
- Background: Green gradient
- Icon: Coins (green)
- Text: Green shades

### Earnings by Type Card:
- Background: Blue gradient
- Icon: Coins (blue)
- Text: Blue shades
- Each type: Light blue background

---

## Filter Functionality

### Type Filter Dropdown:
```typescript
<Select value={selectedType} onValueChange={setSelectedType}>
  <SelectItem value="all">All Types</SelectItem>
  <SelectItem value="English Reading, listening & speaking Task">
    English Reading
  </SelectItem>
  <SelectItem value="Lesson Plan & Delivery">
    Lesson Plan
  </SelectItem>
  <SelectItem value="Soft & Digital Skills">
    Soft & Digital
  </SelectItem>
</Select>
```

When user selects a type:
- Tasks list filters to show only that type
- Earnings card still shows all types (for comparison)

---

## Example Scenarios

### Scenario 1: Employee with Mixed Tasks
```
Total Earnings: ₹500.00

Earnings by Type:
├── English Reading: ₹200.00 (2 tasks)
├── Lesson Plan: ₹150.00 (1 task)
└── Soft & Digital: ₹150.00 (1 task)
```

### Scenario 2: Employee with Only One Type
```
Total Earnings: ₹300.00

Earnings by Type:
└── English Reading: ₹300.00 (3 tasks)
```

### Scenario 3: New Employee (No Earnings)
```
Total Earnings: ₹0.00

Earnings by Type:
└── No earnings yet
```

---

## Benefits

### For Employees:
- ✅ **Clear breakdown**: See which task types earn more
- ✅ **Motivation**: Track progress per type
- ✅ **Goal setting**: Focus on specific task types
- ✅ **Transparency**: Understand earning distribution

### For Admin:
- ✅ **Analytics**: See which task types are popular
- ✅ **Balancing**: Ensure fair distribution of task types
- ✅ **Insights**: Understand employee preferences

---

## Technical Details

### State Variables:
```typescript
const [totalEarnings, setTotalEarnings] = useState<number>(0);
const [earningsByType, setEarningsByType] = useState<Record<string, number>>({});
const [loadingEarnings, setLoadingEarnings] = useState(false);
```

### Fetch Function:
```typescript
const fetchTotalEarnings = async () => {
  // Fetch earnings with task type join
  const { data } = await supabase
    .from("task_earnings")
    .select("amount, status, task_id, tasks!inner(type)")
    .eq("user_id", user.id);
  
  // Calculate total
  const total = data
    .filter(e => e.status === "approved" || e.status === "paid")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  // Calculate by type
  const byType = {};
  data.forEach(earning => {
    const type = earning.tasks.type || "Other";
    byType[type] = (byType[type] || 0) + parseFloat(earning.amount);
  });
  
  setTotalEarnings(total);
  setEarningsByType(byType);
};
```

---

## Files Modified

1. **src/pages/Tasks.tsx**
   - Added `earningsByType` state
   - Updated `fetchTotalEarnings()` to fetch task types
   - Added type-wise calculation logic
   - Updated UI to show 2 cards (Total + By Type)
   - Added responsive grid layout

---

## Testing Checklist

- [ ] Total earnings displays correctly
- [ ] Earnings by type shows all 3 types
- [ ] Amounts match for each type
- [ ] Total equals sum of all types
- [ ] Refresh button works
- [ ] Loading states display properly
- [ ] Empty state shows "No earnings yet"
- [ ] Type filter works correctly
- [ ] Responsive layout works on mobile
- [ ] Dark mode colors look good

---

## Future Enhancements

1. **Charts**: Add pie chart or bar chart for visual representation
2. **Date Range**: Filter earnings by date range
3. **Export**: Download earnings report as PDF/CSV
4. **Comparison**: Compare earnings month-over-month
5. **Goals**: Set earning goals per type
6. **Badges**: Award badges for milestones per type

---

## Support

If earnings don't show correctly:
1. Check if tasks have `type` field set
2. Verify task_earnings table has task_id
3. Check if foreign key relationship exists
4. Verify RLS policies allow reading task details
5. Check browser console for errors
