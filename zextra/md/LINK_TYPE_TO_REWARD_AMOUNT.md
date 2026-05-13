# Link Task Type to Reward Amount

## Feature Overview

Task type select karne par **automatically reward amount** set ho jata hai.

### Predefined Reward Amounts:
```
📚 English Reading → ₹10
📝 Lesson Plan → ₹15
💻 Soft & Digital → ₹20
```

---

## How It Works

### 1. **Create Task Flow**:
```
User selects Type → Reward Amount auto-fills → User can edit if needed
```

### 2. **Type Dropdown**:
```
📚 English Reading (₹10)
📝 Lesson Plan (₹15)
💻 Soft & Digital (₹20)
```

### 3. **Reward Amount Field**:
- Auto-filled based on selected type
- User can still manually change it
- Placeholder: "Auto-filled based on type"

---

## Implementation Details

### State with Predefined Amounts:
```typescript
const rewardAmountsByType: Record<string, string> = {
  "English Reading, listening & speaking Task": "10",
  "Lesson Plan & Delivery": "15",
  "Soft & Digital Skills": "20",
};
```

### Type Selection Handler:
```typescript
onValueChange={(value) => {
  setFormData({ 
    ...formData, 
    type: value,
    reward_amount: rewardAmountsByType[value] || formData.reward_amount
  });
}}
```

### Features:
- ✅ Auto-fill on type selection
- ✅ User can override amount
- ✅ Works in both Create and Edit forms
- ✅ Icons in dropdown for visual clarity
- ✅ Shows amount in dropdown label

---

## User Experience

### Before:
```
1. Select Type: "English Reading"
2. Manually enter Reward: "10"
```

### After:
```
1. Select Type: "📚 English Reading (₹10)"
2. Reward Amount: Auto-filled to "10" ✅
3. (Optional) Edit amount if needed
```

---

## UI Changes

### Create Task Dialog:

**Type Dropdown:**
```
┌─────────────────────────────────┐
│ Type *                          │
├─────────────────────────────────┤
│ 📚 English Reading (₹10)        │
│ 📝 Lesson Plan (₹15)            │
│ 💻 Soft & Digital (₹20)         │
└─────────────────────────────────┘
Reward amount will be auto-filled based on type
```

**Reward Amount Field:**
```
┌─────────────────────────────────┐
│ Reward Amount (₹)               │
├─────────────────────────────────┤
│ 10                              │ ← Auto-filled
└─────────────────────────────────┘
Auto-filled when you select a type. You can change it if needed.
```

---

## Benefits

### For Admin:
- ✅ **Faster task creation**: No need to remember amounts
- ✅ **Consistency**: Same type = same reward (by default)
- ✅ **Flexibility**: Can still customize if needed
- ✅ **Visual clarity**: Icons + amounts in dropdown

### For Employees:
- ✅ **Transparency**: See reward amount upfront
- ✅ **Motivation**: Know earning potential per type
- ✅ **Clear expectations**: Consistent rewards per type

---

## Customization

### Change Default Amounts:

Edit the `rewardAmountsByType` object in `src/pages/Tasks.tsx`:

```typescript
const rewardAmountsByType: Record<string, string> = {
  "English Reading, listening & speaking Task": "15",  // Changed from 10
  "Lesson Plan & Delivery": "20",                      // Changed from 15
  "Soft & Digital Skills": "25",                       // Changed from 20
};
```

### Add New Type:

1. Add to dropdown:
```typescript
<SelectItem value="New Type Name">
  🎯 New Type (₹30)
</SelectItem>
```

2. Add to reward mapping:
```typescript
const rewardAmountsByType = {
  // ... existing types
  "New Type Name": "30",
};
```

---

## Examples

### Example 1: Create English Reading Task
```
1. Select Type: "📚 English Reading (₹10)"
   → Reward Amount: "10" (auto-filled)
2. Keep default or change to "12"
3. Submit
```

### Example 2: Create Lesson Plan Task
```
1. Select Type: "📝 Lesson Plan (₹15)"
   → Reward Amount: "15" (auto-filled)
2. Keep default
3. Submit
```

### Example 3: Edit Existing Task
```
1. Open Edit Dialog
2. Change Type: "💻 Soft & Digital (₹20)"
   → Reward Amount: Updates to "20"
3. Or manually set to "25"
4. Save
```

---

## Integration with Earnings

### Earnings by Type Card:
When tasks are created with these amounts, the earnings breakdown will show:

```
Earnings by Type
├── 📚 English Reading: ₹30.00 (3 tasks × ₹10)
├── 📝 Lesson Plan: ₹45.00 (3 tasks × ₹15)
└── 💻 Soft & Digital: ₹60.00 (3 tasks × ₹20)
```

### Consistency:
- Same type → Same default reward
- Easy to track earnings per type
- Predictable earning structure

---

## Files Modified

1. **src/pages/Tasks.tsx**
   - Added `rewardAmountsByType` mapping
   - Updated Create Task type dropdown
   - Updated Edit Task type dropdown
   - Auto-fill logic on type change
   - Updated reward amount field labels
   - Added helper text

---

## Testing Checklist

- [ ] Create task with English Reading type
- [ ] Verify reward amount auto-fills to ₹10
- [ ] Change reward amount manually
- [ ] Verify custom amount is saved
- [ ] Create task with Lesson Plan type
- [ ] Verify reward amount auto-fills to ₹15
- [ ] Create task with Soft & Digital type
- [ ] Verify reward amount auto-fills to ₹20
- [ ] Edit existing task and change type
- [ ] Verify reward amount updates
- [ ] Submit task and check earnings
- [ ] Verify earnings by type shows correct amounts

---

## Future Enhancements

1. **Dynamic Amounts**: Store amounts in database instead of hardcoded
2. **Admin Config**: Let admin set default amounts per type
3. **History**: Track reward amount changes over time
4. **Bulk Update**: Update all tasks of a type with new amount
5. **Validation**: Warn if amount differs from default
6. **Analytics**: Show average reward per type

---

## Summary

**Before**:
- ❌ Manual entry of reward amount
- ❌ No connection between type and amount
- ❌ Inconsistent rewards

**After**:
- ✅ Auto-fill reward based on type
- ✅ Clear connection: Type → Amount
- ✅ Consistent default rewards
- ✅ Still customizable if needed
- ✅ Visual clarity with icons + amounts

**Result**: Faster task creation + consistent rewards! 🎉
