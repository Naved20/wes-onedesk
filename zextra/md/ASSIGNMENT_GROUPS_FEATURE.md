# Assignment Groups Feature

## Overview
Assignment Groups feature allows admins and managers to organize employees into groups for task assignments, team management, and project organization - similar to Peer Reviewer Groups but for general assignments.

## Features Implemented

### 1. Database Schema
**Tables Created:**
- `assignment_groups` - Stores group information
- `assignment_group_members` - Many-to-many relationship between groups and employees

**Key Fields:**
- Group name (unique)
- Description
- Active status
- Created by tracking
- Member count

### 2. Assignment Groups Page (`/assignment-groups`)

**Access:**
- Admin: Full access (create, edit, delete, manage members)
- Manager: View and manage members only
- Employee: No access

**Features:**
- ✅ Create new assignment groups
- ✅ Edit group name and description
- ✅ Delete groups (soft delete)
- ✅ Manage group members
- ✅ View member count
- ✅ Card-based layout

### 3. Group Management

**Create Group:**
- Group name (required, unique)
- Description (optional)
- Auto-tracks creator

**Edit Group:**
- Update name
- Update description
- Only admins can edit

**Delete Group:**
- Soft delete (sets is_active = false)
- Confirmation dialog
- Only admins can delete

### 4. Member Management

**Manage Members Dialog:**
- Shows all active employees
- Checkbox selection
- Displays employee details:
  - Name
  - Email
  - Designation badge
  - Institution badge
- Shows selection count
- Bulk add/remove members

**Member Display:**
- Employee name and email
- Designation and institution
- Added date tracking
- Easy selection interface

### 5. Database Functions

**`get_assignment_group_members(group_id)`**
- Returns all members of a group with employee details
- Includes: name, email, designation, institution, added_at
- Only active employees

**`get_user_assignment_groups(user_id)`**
- Returns all groups a user belongs to
- Includes: group name, description, member count
- Only active groups

### 6. RLS Policies

**assignment_groups:**
- Admins/Managers: View all groups
- Employees: View only groups they're members of
- Only admins: Create, update, delete

**assignment_group_members:**
- Admins/Managers: View all members
- Employees: View members of their groups
- Only admins: Add/remove members

## UI/UX Features

### Card Layout
- Grid of group cards (responsive)
- Shows group name and description
- Member count with icon
- Action buttons (Manage, Edit, Delete)

### Dialogs
- **Create Dialog**: Simple form with name and description
- **Edit Dialog**: Pre-filled form for editing
- **Members Dialog**: Scrollable list with checkboxes
- **Delete Dialog**: Confirmation with group name

### Visual Elements
- Users icon for member count
- UserCheck icon in sidebar
- Color-coded badges for employee info
- Responsive grid layout (1/2/3 columns)

## Use Cases

### 1. Team Organization
- Create groups for different teams (Dev, Marketing, Sales)
- Assign employees to their respective teams
- Track team membership

### 2. Project Assignments
- Create groups for specific projects
- Add relevant team members
- Manage project teams

### 3. Department Management
- Organize by departments
- Track department members
- Facilitate department-wide tasks

### 4. Task Distribution
- Create groups for task categories
- Assign tasks to groups
- Track group responsibilities

## Comparison with Peer Reviewer Groups

### Similarities:
- ✅ Group creation and management
- ✅ Member management
- ✅ Card-based UI
- ✅ Admin/Manager access
- ✅ Soft delete

### Differences:
- **Purpose**: General assignments vs. peer review specific
- **Icon**: UserCheck vs. Users
- **Use Case**: Broader team organization vs. review workflows
- **Flexibility**: Can be used for any grouping need

## Database Migration

**File**: `ADD_ASSIGNMENT_GROUPS_MIGRATION.sql`

**Run in Supabase SQL Editor to create:**
1. `assignment_groups` table
2. `assignment_group_members` table
3. Indexes for performance
4. RLS policies for security
5. Helper functions

## Files Created/Modified

### Created:
- `ADD_ASSIGNMENT_GROUPS_MIGRATION.sql` - Database schema
- `src/pages/AssignmentGroups.tsx` - Main page component
- `ASSIGNMENT_GROUPS_FEATURE.md` - Documentation

### Modified:
- `src/App.tsx` - Added route
- `src/components/layout/DashboardLayout.tsx` - Added menu item

## API Endpoints (Supabase)

### Tables:
- `assignment_groups` - CRUD operations
- `assignment_group_members` - Add/remove members

### Functions:
- `get_assignment_group_members(group_id)` - Get members with details
- `get_user_assignment_groups(user_id)` - Get user's groups

## Security

### Access Control:
- ✅ RLS policies enforce role-based access
- ✅ Only admins can create/edit/delete groups
- ✅ Managers can view and manage members
- ✅ Employees can only see their groups

### Data Protection:
- ✅ Soft delete preserves data
- ✅ Audit trail with created_by
- ✅ Unique constraints prevent duplicates
- ✅ Foreign key constraints maintain integrity

## Future Enhancements

### Potential Features:
- [ ] Group hierarchy (parent/child groups)
- [ ] Group permissions and roles
- [ ] Bulk import members from CSV
- [ ] Group templates
- [ ] Activity log for group changes
- [ ] Email notifications for group assignments
- [ ] Group-based task assignment integration
- [ ] Export group member lists
- [ ] Group statistics and analytics

## Testing Checklist

### Admin:
- [ ] Create new group
- [ ] Edit group details
- [ ] Delete group
- [ ] Add members to group
- [ ] Remove members from group
- [ ] View all groups
- [ ] View member counts

### Manager:
- [ ] View all groups
- [ ] Manage group members
- [ ] Cannot create groups
- [ ] Cannot edit group details
- [ ] Cannot delete groups

### Employee:
- [ ] Cannot access page
- [ ] Redirected to dashboard

## Benefits

✅ **Organization**: Better team structure
✅ **Flexibility**: Use for any grouping need
✅ **Efficiency**: Quick member management
✅ **Scalability**: Handles large teams
✅ **Security**: Role-based access control
✅ **Audit**: Track group changes
✅ **Integration**: Ready for task assignment features
