# Requirements Document: Task Management System

## Introduction

The Task Management System is a feature for the WES OneDesk HR management application that enables managers and admins to create, assign, and track tasks for employees. Employees can view their assigned tasks, update task status, and add comments. The system provides role-based access control, notifications, filtering capabilities, and comprehensive task tracking to improve workflow coordination and accountability across the organization.

## Glossary

- **Task_System**: The task management feature module
- **Task**: A work item with title, description, assignee, priority, status, and due date
- **Employee**: A user with role "employee" who can view and update assigned tasks
- **Manager**: A user with role "manager" who can create, assign, edit, and delete tasks
- **Admin**: A user with role "admin" who has all manager permissions
- **Task_Creator**: A manager or admin who creates tasks
- **Task_Assignee**: An employee to whom a task is assigned
- **Task_Status**: The current state of a task (pending, in-progress, completed, cancelled)
- **Task_Priority**: The urgency level of a task (low, medium, high, urgent)
- **Task_Comment**: A note added to a task by any user with timestamp
- **Task_Notification**: A system notification sent when task events occur
- **Tasks_Page**: The main UI page accessible at route /tasks
- **Task_Database**: The Supabase PostgreSQL database tables (tasks, task_comments)

## Requirements

### Requirement 1: Tasks Page Navigation

**User Story:** As a user (employee, manager, or admin), I want to access a dedicated Tasks page from the sidebar menu, so that I can manage and view tasks.

#### Acceptance Criteria

1. THE Task_System SHALL add a "Tasks" menu item to the sidebar navigation
2. THE Task_System SHALL display an appropriate icon next to the Tasks menu item
3. WHEN a user clicks the Tasks menu item, THE Task_System SHALL navigate to route "/tasks"
4. THE Tasks_Page SHALL be accessible to users with roles: employee, manager, and admin

### Requirement 2: Employee Task Viewing

**User Story:** As an employee, I want to view all tasks assigned to me, so that I know what work I need to complete.

#### Acceptance Criteria

1. WHEN an employee accesses the Tasks_Page, THE Task_System SHALL display only tasks where assigned_to equals the employee's user_id
2. FOR EACH task, THE Task_System SHALL display the title, description, due date, priority, and status
3. THE Task_System SHALL display tasks in a card or table layout using shadcn/ui components
4. THE Task_System SHALL apply color coding to task cards based on priority level
5. THE Task_System SHALL display status badges with color coding (pending=yellow, in-progress=blue, completed=green, cancelled=gray)

### Requirement 3: Employee Task Filtering and Sorting

**User Story:** As an employee, I want to filter and sort my tasks, so that I can focus on specific work items.

#### Acceptance Criteria

1. THE Task_System SHALL provide a filter control for status with options: pending, in-progress, completed
2. WHEN an employee selects a status filter, THE Task_System SHALL display only tasks matching that status
3. THE Task_System SHALL provide a sort control with options: due date, priority
4. WHEN an employee selects a sort option, THE Task_System SHALL reorder tasks according to the selected criterion
5. THE Task_System SHALL sort by due date in ascending order (earliest first)
6. THE Task_System SHALL sort by priority in descending order (urgent, high, medium, low)

### Requirement 4: Employee Task Completion

**User Story:** As an employee, I want to mark tasks as complete, so that I can track my progress and notify managers.

#### Acceptance Criteria

1. WHEN an employee views a task with status "pending" or "in-progress", THE Task_System SHALL display a "Mark as Complete" action button
2. WHEN an employee clicks "Mark as Complete", THE Task_System SHALL update the task status to "completed"
3. WHEN a task status changes to "completed", THE Task_System SHALL set the completed_at timestamp to the current date and time
4. WHEN a task is marked complete, THE Task_System SHALL send a Task_Notification to the Task_Creator
5. THE Task_System SHALL prevent employees from marking already completed or cancelled tasks as complete

### Requirement 5: Task Comments

**User Story:** As a user, I want to add comments to tasks, so that I can provide updates, ask questions, or document progress.

#### Acceptance Criteria

1. WHEN a user views task details, THE Task_System SHALL display all existing Task_Comments in chronological order
2. THE Task_System SHALL display each Task_Comment with the comment text, author name, and timestamp
3. THE Task_System SHALL provide a text input field for adding new comments
4. WHEN a user submits a comment, THE Task_System SHALL insert a record into the task_comments table with task_id, user_id, comment text, and created_at timestamp
5. THE Task_System SHALL refresh the comments list after a new comment is added

### Requirement 6: Manager Task Creation

**User Story:** As a manager or admin, I want to create new tasks and assign them to employees, so that I can delegate work.

#### Acceptance Criteria

1. WHEN a manager or admin accesses the Tasks_Page, THE Task_System SHALL display a "Create Task" button
2. WHEN a manager clicks "Create Task", THE Task_System SHALL open a dialog with a task creation form
3. THE Task_System SHALL require the title field in the task creation form
4. THE Task_System SHALL provide optional fields: description (rich text), assigned_to (employee selector), priority (dropdown), due_date (date picker)
5. WHEN a manager submits the form with valid data, THE Task_System SHALL insert a record into the tasks table with status "pending" and created_at timestamp
6. WHEN a task is created with an assigned employee, THE Task_System SHALL send a Task_Notification to the Task_Assignee
7. THE Task_System SHALL set created_by to the manager's user_id

### Requirement 7: Manager Task Assignment

**User Story:** As a manager or admin, I want to assign tasks to specific employees or multiple employees, so that I can distribute work effectively.

#### Acceptance Criteria

1. THE Task_System SHALL provide an employee selector in the task creation and edit forms
2. THE Task_System SHALL populate the employee selector with all active employees from the employee_profiles table
3. WHEN a manager selects an employee, THE Task_System SHALL set the assigned_to field to that employee's user_id
4. THE Task_System SHALL support creating multiple task instances when assigning to multiple employees
5. WHEN a task is assigned to multiple employees, THE Task_System SHALL create separate task records for each employee with identical properties except assigned_to

### Requirement 8: Manager Task Editing

**User Story:** As a manager or admin, I want to edit existing tasks, so that I can update details or correct mistakes.

#### Acceptance Criteria

1. WHEN a manager views a task, THE Task_System SHALL display an "Edit" action button
2. WHEN a manager clicks "Edit", THE Task_System SHALL open a dialog pre-filled with current task data
3. THE Task_System SHALL allow editing of title, description, assigned_to, priority, status, and due_date fields
4. WHEN a manager submits the edit form, THE Task_System SHALL update the task record and set updated_at to the current timestamp
5. WHEN the assigned_to field changes, THE Task_System SHALL send a Task_Notification to the new Task_Assignee

### Requirement 9: Manager Task Deletion

**User Story:** As a manager or admin, I want to delete tasks, so that I can remove obsolete or incorrect tasks.

#### Acceptance Criteria

1. WHEN a manager views a task, THE Task_System SHALL display a "Delete" action button
2. WHEN a manager clicks "Delete", THE Task_System SHALL display a confirmation dialog
3. WHEN a manager confirms deletion, THE Task_System SHALL delete the task record from the tasks table
4. WHEN a task is deleted, THE Task_System SHALL also delete all associated records from the task_comments table

### Requirement 10: Manager Comprehensive Task View

**User Story:** As a manager or admin, I want to view all tasks across all employees, so that I can monitor overall progress.

#### Acceptance Criteria

1. WHEN a manager or admin accesses the Tasks_Page, THE Task_System SHALL display all tasks regardless of assigned_to value
2. THE Task_System SHALL display the employee name for each task
3. THE Task_System SHALL provide a filter control for employee selection
4. WHEN a manager selects an employee filter, THE Task_System SHALL display only tasks assigned to that employee
5. THE Task_System SHALL provide filter controls for status, priority, and date range
6. WHEN a manager applies multiple filters, THE Task_System SHALL display only tasks matching all selected criteria

### Requirement 11: Manager Bulk Operations

**User Story:** As a manager or admin, I want to perform bulk operations on multiple tasks, so that I can manage tasks efficiently.

#### Acceptance Criteria

1. THE Task_System SHALL provide checkboxes for selecting multiple tasks
2. WHEN a manager selects multiple tasks, THE Task_System SHALL display a bulk actions toolbar
3. THE Task_System SHALL provide a "Mark as Complete" bulk action
4. WHEN a manager executes "Mark as Complete" on selected tasks, THE Task_System SHALL update the status to "completed" for all selected tasks
5. THE Task_System SHALL provide a "Bulk Assign" action for reassigning multiple tasks to a different employee
6. WHEN a manager executes "Bulk Assign", THE Task_System SHALL update the assigned_to field for all selected tasks

### Requirement 12: Task Priority Management

**User Story:** As a manager or admin, I want to set task priority levels, so that employees know which tasks are most urgent.

#### Acceptance Criteria

1. THE Task_System SHALL support four priority levels: low, medium, high, urgent
2. THE Task_System SHALL apply color coding to priority indicators (low=gray, medium=blue, high=orange, urgent=red)
3. WHEN a manager creates or edits a task, THE Task_System SHALL provide a dropdown to select priority
4. THE Task_System SHALL display the priority level prominently on task cards and in task details

### Requirement 13: Task Due Date Management

**User Story:** As a user, I want to see task due dates, so that I can prioritize time-sensitive work.

#### Acceptance Criteria

1. THE Task_System SHALL allow managers to set an optional due_date when creating or editing tasks
2. THE Task_System SHALL display the due date on task cards and in task details
3. WHEN the current date is within 2 days of the due_date and status is not "completed", THE Task_System SHALL highlight the task as "due soon"
4. WHEN the current date is past the due_date and status is not "completed", THE Task_System SHALL highlight the task as "overdue"
5. THE Task_System SHALL use visual indicators (color, icon) to distinguish overdue and due soon tasks

### Requirement 14: Task Assignment Notifications

**User Story:** As an employee, I want to receive notifications when tasks are assigned to me, so that I am aware of new work.

#### Acceptance Criteria

1. WHEN a task is created with assigned_to set to an employee's user_id, THE Task_System SHALL create a notification record for that employee
2. THE notification SHALL include the task title and the name of the Task_Creator
3. THE Task_System SHALL display the notification in the application's notification area
4. THE notification SHALL include a link to view the task details

### Requirement 15: Task Completion Notifications

**User Story:** As a manager or admin, I want to receive notifications when assigned tasks are completed, so that I can track progress.

#### Acceptance Criteria

1. WHEN a task status changes to "completed", THE Task_System SHALL create a notification record for the user_id in the created_by field
2. THE notification SHALL include the task title and the name of the Task_Assignee who completed it
3. THE Task_System SHALL display the notification in the application's notification area
4. THE notification SHALL include a link to view the task details

### Requirement 16: Task Due Date Reminders

**User Story:** As an employee, I want to receive reminder notifications before task due dates, so that I don't miss deadlines.

#### Acceptance Criteria

1. WHEN the current date is 1 day before a task's due_date and the task status is not "completed" or "cancelled", THE Task_System SHALL create a reminder notification for the Task_Assignee
2. THE notification SHALL include the task title and due date
3. THE Task_System SHALL send the reminder notification once per task
4. THE notification SHALL include a link to view the task details

### Requirement 17: Task Database Schema

**User Story:** As a developer, I want a properly structured database schema for tasks, so that task data is stored reliably and efficiently.

#### Acceptance Criteria

1. THE Task_Database SHALL include a table named "tasks" with columns: id (UUID primary key), title (text not null), description (text nullable), assigned_to (UUID foreign key to auth.users), created_by (UUID foreign key to auth.users), priority (text not null), status (text not null), due_date (date nullable), created_at (timestamp with time zone), completed_at (timestamp with time zone nullable), updated_at (timestamp with time zone)
2. THE Task_Database SHALL include a table named "task_comments" with columns: id (UUID primary key), task_id (UUID foreign key to tasks), user_id (UUID foreign key to auth.users), comment (text not null), created_at (timestamp with time zone)
3. THE Task_Database SHALL enforce foreign key constraints for assigned_to, created_by, task_id, and user_id
4. THE Task_Database SHALL set default values: status="pending", created_at=now(), updated_at=now()
5. THE Task_Database SHALL create indexes on assigned_to, created_by, status, and due_date columns for query performance

### Requirement 18: Task UI Consistency

**User Story:** As a user, I want the Tasks page to match the existing application design, so that the interface feels cohesive.

#### Acceptance Criteria

1. THE Task_System SHALL use shadcn/ui components (Card, Table, Dialog, Badge, Button, Select, Calendar, Textarea)
2. THE Task_System SHALL follow the existing color scheme and typography from other pages
3. THE Task_System SHALL implement responsive design that works on mobile, tablet, and desktop screen sizes
4. THE Task_System SHALL use the same layout structure as other pages (DashboardLayout component)
5. THE Task_System SHALL maintain consistent spacing, borders, and visual hierarchy with existing pages

### Requirement 19: Task Status Management

**User Story:** As a user, I want clear task status indicators, so that I can quickly understand task progress.

#### Acceptance Criteria

1. THE Task_System SHALL support four status values: pending, in-progress, completed, cancelled
2. THE Task_System SHALL display status badges with consistent color coding (pending=yellow, in-progress=blue, completed=green, cancelled=gray)
3. WHEN an employee views their tasks, THE Task_System SHALL allow changing status from "pending" to "in-progress"
4. WHEN an employee views their tasks, THE Task_System SHALL allow changing status from "in-progress" to "completed"
5. WHEN a manager views tasks, THE Task_System SHALL allow changing status to any valid value including "cancelled"

### Requirement 20: Task Description Rich Text

**User Story:** As a manager, I want to format task descriptions with rich text, so that I can provide clear and structured instructions.

#### Acceptance Criteria

1. THE Task_System SHALL provide a rich text editor for the description field in task creation and edit forms
2. THE Task_System SHALL support basic formatting: bold, italic, bullet lists, numbered lists, and links
3. THE Task_System SHALL store formatted description as HTML or markdown in the database
4. WHEN displaying task details, THE Task_System SHALL render the formatted description with proper styling
5. THE Task_System SHALL sanitize description content to prevent XSS attacks

