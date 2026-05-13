# Task Assignment Groups Integration - Changes Required

## Overview
Add support for assigning Assignment Groups to tasks, similar to how Peer Reviewer Groups work.

## Changes to src/pages/Tasks.tsx

### 1. Add State for Assignment Groups

After line 224 (reviewerGroups state), add:
```typescript
const [assignmentGroups, setAssignmentGroups] = useState<Array<{ id: string; name: string; member_ids: string[] }>>([]);
```

### 2. Update formData State (around line 210)

Change from:
```typescript
const [formData, setFormData] = useState({
  title: "",
  description: "",
  type: "",
  category: "",
  reward_amount: "",
  due_date: "",
  file: null as File | null,
  assign_to: "all" as "all" | "specific",
  assigned_user_ids: [] as string[],
  peer_reviewer_ids: [] as string[],
  peer_reviewer_group_ids: [] as string[],
  review_assignment_type: "group" as "group" | "individual" | "mixed",
  individual_reviewer_assignments: [] as Array<{ user_id: string; reviewer_id: string }>,
});
```

To:
```typescript
const [formData, setFormData] = useState({
  title: "",
  description: "",
  type: "",
  category: "",
  reward_amount: "",
  due_date: "",
  file: null as File | null,
  assign_to: "all" as "all" | "specific" | "groups",
  assigned_user_ids: [] as string[],
  assignment_group_ids: [] as string[],
  peer_reviewer_ids: [] as string[],
  peer_reviewer_group_ids: [] as string[],
  review_assignment_type: "group" as "group" | "individual" | "mixed",
  individual_reviewer_assignments: [] as Array<{ user_id: string; reviewer_id: string }>,
});
```

### 3. Update editFormData State (around line 270)

Same changes as formData - add `assignment_group_ids: [] as string[]` and update `assign_to` type.

### 4. Add fetchAssignmentGroups Function

After `fetchReviewerGroups` function (around line 720), add:
```typescript
const fetchAssignmentGroups = async () => {
  try {
    const [{ data: groups }, { data: members }] = await Promise.all([
      (supabase as any).from("assignment_groups").select("id, name").eq("is_active", true).order("name"),
      (supabase as any).from("assignment_group_members").select("group_id, user_id"),
    ]);
    const memberRows = (members || []) as Array<{ group_id: string; user_id: string }>;
    const groupsWithMembers = (groups || []).map((g: any) => ({
      ...g,
      member_ids: memberRows.filter(m => m.group_id === g.id).map(m => m.user_id),
    }));
    setAssignmentGroups(groupsWithMembers);
  } catch (error) {
    console.error("Error fetching assignment groups:", error);
  }
};
```

### 5. Call fetchAssignmentGroups in useEffect

In the main useEffect (around line 300), add:
```typescript
fetchAssignmentGroups();
```

### 6. Update handleCreateTask Function (around line 780)

After handling task_assignments, add assignment group logic:

```typescript
// Handle assignment groups
if (formData.assign_to === "groups" && formData.assignment_group_ids.length > 0) {
  // Get all members from selected groups
  const groupMemberIds = formData.assignment_group_ids
    .flatMap(gid => assignmentGroups.find(g => g.id === gid)?.member_ids || []);
  const uniqueMemberIds = Array.from(new Set(groupMemberIds));

  if (uniqueMemberIds.length > 0) {
    const assignments = uniqueMemberIds.map(uid => ({
      task_id: (taskData as any).id,
      user_id: uid,
    }));
    const { error: assignError } = await supabase
      .from("task_assignments" as any)
      .insert(assignments);
    if (assignError) throw assignError;
  }

  // Record which groups were assigned
  const groupRefs = formData.assignment_group_ids.map(gid => ({
    task_id: (taskData as any).id,
    group_id: gid,
  }));
  const { error: grpError } = await (supabase as any)
    .from("task_assignment_groups")
    .insert(groupRefs);
  if (grpError) throw grpError;
}
```

### 7. Update resetForm Function (around line 900)

Add:
```typescript
assignment_group_ids: [],
```

### 8. Update openEditDialog Function (around line 1220)

After fetching peer reviewer groups, add:

```typescript
// Fetch assigned groups
const { data: assignedGroups } = await (supabase as any)
  .from("task_assignment_groups")
  .select("group_id")
  .eq("task_id", task.id);
const assignedGroupIds = (assignedGroups || []).map((g: any) => g.group_id);
```

Then in setEditFormData, add:
```typescript
assignment_group_ids: assignedGroupIds,
assign_to: assignedGroupIds.length > 0 ? "groups" : (assignedUserIds.length === employees.length ? "all" : "specific"),
```

### 9. Update handleEditTask Function (around line 1340)

After deleting existing assignments, add:

```typescript
// Delete existing assignment groups
await (supabase as any)
  .from("task_assignment_groups")
  .delete()
  .eq("task_id", editingTask.id);
```

Then after handling task_assignments, add the same assignment group logic as in handleCreateTask.

### 10. Add UI for Assignment Groups in Create Dialog

After the "Assign To" radio buttons (around line 1950), add a new radio option:

```typescript
<div className="flex items-center space-x-2">
  <input
    type="radio"
    id="assign-groups"
    name="assign_to"
    value="groups"
    checked={formData.assign_to === "groups"}
    onChange={(e) => setFormData({ ...formData, assign_to: e.target.value as any })}
    className="h-4 w-4"
  />
  <Label htmlFor="assign-groups" className="cursor-pointer">
    Assign to Groups
  </Label>
</div>
```

Then add the group selection UI (after the specific users section):

```typescript
{formData.assign_to === "groups" && (
  <div className="space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
    <Label className="text-base font-semibold flex items-center gap-2">
      <UserCheck className="h-5 w-5" />
      Select Assignment Groups
    </Label>
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {assignmentGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignment groups available</p>
      ) : (
        assignmentGroups.map((g) => (
          <div key={g.id} className="flex items-center space-x-2 p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded">
            <Checkbox
              id={`assign-grp-${g.id}`}
              checked={formData.assignment_group_ids.includes(g.id)}
              onCheckedChange={(checked) => {
                setFormData(prev => ({
                  ...prev,
                  assignment_group_ids: checked
                    ? [...prev.assignment_group_ids, g.id]
                    : prev.assignment_group_ids.filter(id => id !== g.id),
                }));
              }}
            />
            <Label htmlFor={`assign-grp-${g.id}`} className="cursor-pointer flex-1">
              {g.name} ({g.member_ids.length} members)
            </Label>
          </div>
        ))
      )}
    </div>
    {formData.assignment_group_ids.length > 0 && (
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
        ✅ {formData.assignment_group_ids.length} group(s) selected
      </p>
    )}
  </div>
)}
```

### 11. Add Same UI for Edit Dialog

Repeat step 10 for the edit dialog (around line 3500), using `editFormData` instead of `formData`.

## Summary of Changes

1. ✅ Add `assignmentGroups` state
2. ✅ Add `assignment_group_ids` to formData and editFormData
3. ✅ Update `assign_to` type to include "groups"
4. ✅ Add `fetchAssignmentGroups()` function
5. ✅ Call fetch function in useEffect
6. ✅ Handle group assignment in `handleCreateTask`
7. ✅ Handle group assignment in `handleEditTask`
8. ✅ Add group selection UI in create dialog
9. ✅ Add group selection UI in edit dialog
10. ✅ Update `openEditDialog` to load assigned groups
11. ✅ Update `resetForm` to clear group selection

## Database Requirements

Run `ADD_ASSIGNMENT_GROUPS_MIGRATION.sql` which now includes:
- `assignment_groups` table
- `assignment_group_members` table
- `task_assignment_groups` table (NEW - tracks group assignments)

## Result

Users can now:
- Select "Assign to Groups" option
- Choose one or more assignment groups
- All members of selected groups automatically get the task assigned
- Edit task to change group assignments
- Groups are tracked separately for easy management
