# OneDesk — Database & Schema Documentation

Backend: PostgreSQL (Lovable Cloud / Supabase). All application tables live in the `public` schema. Authentication is handled by the managed `auth.users` table.

---

## 1. Overview

The database supports an HR / Payroll / Task / Attendance platform for the WES group of institutions (WES, DPS, CLAS, WESA). Data is organized into these functional areas:

| Area | Key tables |
|---|---|
| Identity & Roles | `user_roles`, `employee_profiles`, `manager_institutions`, `login_history` |
| Attendance | `attendance`, `attendance_audit`, `attendance_rules`, `attendance_summary`, `holidays`, `shifts`, `employee_shifts` |
| Face Attendance | `face_descriptors`, `face_attendance_sessions`, `face_checkin_history` |
| Leaves | `leaves`, `leave_balances` |
| Salary / Payroll | `salary_structures`, `salaries`, `payroll_register`, `salary_audit`, `earning_types`, `earning_structure`, `variable_earnings`, `deduction_types`, `manual_deductions` |
| Tasks | `tasks`, `task_assignments`, `task_assignment_groups`, `assignment_groups`, `assignment_group_members`, `task_responses`, `task_remarks`, `task_earnings`, `individual_peer_reviewers`, `task_peer_reviewers`, `peer_reviewer_groups`, `peer_reviewer_group_members`, `task_peer_reviewer_groups` |
| Documents | `documents`, `document_types`, `company_documents`, `appraisals` |
| Announcements & Support | `announcements`, `support_requests`, `support_request_replies`, `quick_links` |
| Notifications | `notifications`, `notification_preferences`, `user_fcm_tokens` |
| Reporting | `weekly_reports`, `weekly_report_tasks`, `weekly_report_goals`, `weekly_report_achievements`, `weekly_report_challenges`, `weekly_report_comments`, `uploaded_reports` |
| WES Teacher Reports | `wes_weekly_reports`, `wes_daily_reports`, `wes_class_updates`, `wes_lesson_plans`, `wes_academic_feedback`, `wes_operations_feedback`, `wes_challenges` |
| Performance | `performance_reviews` |

---

## 2. Enums

- **app_role**: `admin`, `manager`, `employee`
- **attendance_status**: `present`, `approved`, `absent`, `paid_leave`, `leave`, `pending`, `rejected`, `holiday`
- **leave_status**: `pending`, `approved`, `rejected`
- **leave_type**: `casual`, `sick`, `unplanned`, `emergency`, `medical`, `lop`, `half_day`

---

## 3. Tables

Every table below has `id uuid PK default gen_random_uuid()` unless noted, plus `created_at` / `updated_at timestamptz` where applicable.

### 3.1 Identity & Roles

#### `user_roles`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → `auth.users(id)` |
| role | app_role | default `employee` |
| created_at | timestamptz | |

- Unique `(user_id, role)`.
- Admin role is enforced to a **single user** by trigger `prevent_additional_admins`; deletion of an admin row is blocked by `prevent_admin_deletion`.

#### `employee_profiles`
Full HR master record (75 columns) — includes personal (`first_name`, `last_name`, `dob`, `gender`, `blood_group`), contact (`email`, `phone`, address blocks for current & permanent), employment (`employee_id`, `institution_assignment`, `department`, `designation`, `employment_type`, `date_of_joining`, `probation_end_date`, `seniority`, `program`), banking (`bank_name`, `bank_account_number`, `bank_ifsc_code`, `pan_number`, `aadhar_number`), qualifications and misc (`skills`, `profile_photo_url`, `wes_mail`, `biometric_id`, `samagra_id`, etc.).
- Unique on `user_id` and `employee_id`.
- FK `user_id → auth.users(id) ON DELETE CASCADE`.

#### `manager_institutions`
Maps a manager (`manager_user_id`) to an `institution_name` (one row per institution the manager oversees). Unique `(manager_user_id, institution_name)`.

#### `login_history`
`user_id`, `login_at`, `ip_address`, `user_agent`.

---

### 3.2 Attendance

#### `attendance`
27 columns — one row per user per date.
Key columns: `user_id`, `date`, `check_in_time`, `check_out_time`, `status` (attendance_status), `is_half_day`, `half_day_type`, `is_late`, `presence_value`, `calculated_status` (varchar bucket used by stats), `shift_id`, `is_manual_override`, `admin_override`, `approved_by/at`, `modified_by/at`, `original_status`, `rejection_reason`, `notes`, plus embedded holiday fields (`holiday_name`, `holiday_description`, `is_national`, `institution_name`).
- Unique `(user_id, date)`.
- Triggers: `audit_attendance_changes`, `handle_attendance_checkin`, `prevent_absent_on_holidays`, `notify_attendance`.

#### `attendance_audit`
Immutable trail: `attendance_id`, `action`, `old_status`, `new_status`, `old_data`, `new_data`, `changed_by`, `change_reason`.

#### `attendance_rules`
Named org-wide rules (`rule_name` unique). Any authenticated user may modify (intended for admin UI).

#### `attendance_summary`
Monthly rollup per user with `payroll_days`, `present_days`, `half_days`, `holiday_count`, `paid_leave_days`, `leave_days`, `absent_days`, `late_days`, `late_sets`, `total_paid_days`, `attendance_percentage`. `attendance_summary_backup` is a raw copy without RLS.

#### `shifts` / `employee_shifts`
- `shifts`: `name`, `start_time`, `end_time`, `late_threshold_minutes`, `half_day_threshold_hours`, `last_checkin_hours_before_end`, `is_active`.
- `employee_shifts`: assignment row `(user_id, shift_id, effective_from, effective_to)`.

#### `holidays`
`date`, `name`, `description`, `is_national`, `institution_name` (NULL = all institutions). Trigger `trigger_sync_holiday` fans holiday rows out into `attendance` as `status='holiday'`, and `auto_add_sundays_for_new_year` pre-creates all Sundays for a fresh year. `holidays_view` returns the same data joined with attendance.

---

### 3.3 Face Attendance

#### `face_descriptors`
Per-user (unique `user_id`) face embedding stored as `jsonb` `descriptor`, plus `photo_url`, `enrolled_by`, `enrolled_at`, `is_active`. Admin-only writes; any authenticated user can read active ones for matching.

#### `face_attendance_sessions`
Kiosk sessions: `session_token` (unique), device / browser / OS metadata, IP, `login_time`, `last_activity`, `logout_time`, `is_active`, geolocation (`latitude`, `longitude`, `location_accuracy`, `location_address`). Cleaned by `cleanup_old_face_sessions()` (>30d inactive).

#### `face_checkin_history`
Every match attempt: `user_id`, `matched`, `match_distance`, `attendance_id`, `notes`.

---

### 3.4 Leaves

#### `leaves`
`user_id`, `start_date`, `end_date`, `reason`, `leave_type` (enum), `is_emergency`, `is_half_day`, `half_day_type`, `medical_document_url`, `status` (enum), `approved_by/at`, `rejection_reason`, `working_days_count`, `salary_deduction_percent`, `auto_rejected`, `auto_rejection_reason`.
- Triggers: `validate_leave_request` (eligibility + auto-reject), `sync_leave_to_attendance` / `sync_leave_to_attendance_insert` (fans out approved leave into `attendance`), `update_leave_balance_on_approval`, `notify_leave`.

#### `leave_balances`
Per `(user_id, year, month)` — entitled and used counters split by type (`casual_leaves_used`, `sick_leaves_used`, `medical_leaves_used`, `emergency_leaves_used`, `lop_leaves_used`, `unplanned_leaves_used`, `half_day_leaves_used`).

---

### 3.5 Salary & Payroll

#### `salary_structures`
Per-user active configuration: `fixed_gross_salary`, `basic_percentage` (50), `hra_percentage` (40), `other_allowance_percentage` (30), EPF/ESIC applicability + rates, bank details, PF UAN, ESIC IP, `effective_from/to`, `is_active`. One active row per user (`unique_active_salary_per_user`).

#### `salaries`
Monthly worksheet per `(user_id, month, year)` — 54 columns.
- Attendance snapshot: `working_days`, `present_days`, `half_days`, `paid_leave_days`, `absent_days`, `late_days`, `holiday_count`, `sick_leaves`.
- Earnings: `base_salary`, `per_day_salary`, `basic_earned`, `hra_earned`, `other_allowance_earned`, `variable_earnings_details` (jsonb), `variable_earnings_total`, `hra_amount`, `travel_allowance`, `special_bonus`, `gross_salary`.
- Deductions: `epf_employee`, `esic_employee`, `pf_deduction`, `tds_deduction`, `professional_tax`, `other_deductions`, `manual_deduction`, `manual_deductions_details` (jsonb), `manual_deductions_total`, `total_deductions`.
- Employer & CTC: `epf_employer`, `esic_employer`, `total_employer_contribution`, `total_ctc`.
- Approval flow: `approval_status` (draft/proposed/approved), `manager_proposed_salary/by/at/justification`, `approved_by/at`, `approval_notes`, `is_locked`, `locked_by/at`, `net_salary_calculated`, `net_salary_manual`, `final_salary`.
- Trigger `audit_salary_changes` writes to `salary_audit`.

#### `payroll_register`
Finalized payslip per month (unique `(user_id, payroll_month)`, unique `payslip_number`) — 46 columns mirroring `salaries` but locked with `status`, `paid_date`, `payment_mode`, `payment_reference`. Trigger `notify_payroll` on insert/status change. View `payroll_register_view` denormalizes for reporting.

#### Configuration tables
- `earning_types` (`earning_code` unique, `earning_name`, `is_taxable`, `display_order`).
- `earning_structure` (task-driven earnings catalog: `task_type`, `rate`, `frequency`, `monthly_earning`, `how_to_earn`).
- `variable_earnings` (per-user monthly add-ons referencing `earning_types`).
- `deduction_types` (`deduction_code` unique, `is_statutory`).
- `manual_deductions` (per-user monthly deductions referencing `deduction_types`).

---

### 3.6 Tasks

#### `tasks`
`title`, `description`, `created_by`, `due_date`, `is_active`, `file_url/name`, `display_order`, `category`, `type`, `reward_amount`, `review_assignment_type` (default `group`).

#### Assignment
- `task_assignments` — direct user assignment `(task_id, user_id)`.
- `assignment_groups` + `assignment_group_members` — reusable audience lists.
- `task_assignment_groups` — junction attaching a group to a task.

#### Responses & Grading
- `task_responses` — user submission per task (unique `(task_id, user_id)`): `response_text`, `file_url/name`, `article_file_url/name`, `additional_file_url/name`, `link`, `article_link`, `video_link`.
- `task_remarks` — feedback per response with `rating`, plus dimension scores `confidence`, `vocabulary`, `tone`, `hand_gesture`, `speed`.
- `task_earnings` — resolved earning record `(task_id, response_id, user_id)` with `amount`, `remark_id`, `status`.

#### Peer Reviewers
- `individual_peer_reviewers` — legacy per-user assignment for a specific reviewer on a task.
- `task_peer_reviewers` — new unique `(task_id, user_id)` reviewer list.
- `peer_reviewer_groups` + `peer_reviewer_group_members` — reusable reviewer groups.
- `task_peer_reviewer_groups` — attaches a reviewer group to a task (snapshot at creation).
- Helper `public.is_peer_reviewer(user, task)` used in RLS/policies.
- Trigger `notify_peer_reviewer` fires on assignment.

---

### 3.7 Documents

- `documents` — employee-uploaded personal docs (`document_type`, `title`, `document_name`, `file_url`, `verified`, `verified_by/at`). Trigger `notify_document_verified` on verification.
- `document_types` — catalog (`type_name` unique).
- `company_documents` — org-wide policy docs with `applicable_institutes text[]` default `{WES,DPS,CLAS,WESA}`.
- `appraisals` — per-employee appraisal file uploads with `appraisal_period_start/end`.

---

### 3.8 Announcements, Support, Quick Links

- `announcements` — `title`, `content`, `is_org_wide`, `institution`, `expires_at`, optional file attachment. Trigger `notify_announcement` fans out on insert.
- `support_requests` — `subject`, `description`, `status`, `priority`, `category`, `assigned_to`, `resolved_by/at`, `admin_notes`.
- `support_request_replies` — threaded replies with `is_internal` flag; trigger `notify_support_reply` notifies the correct side.
- `quick_links` — dashboard shortcuts `label`, `url`, `icon`, `description`, `sort_order`, `is_active`.

---

### 3.9 Notifications

- `notifications` — `user_id`, `title`, `message`, `type`, `related_id`, `is_read`. Written by `public.notify_user(...)` (SECURITY DEFINER) called from various triggers.
- `notification_preferences` — per-user master `enabled` toggle + per-type toggles (`announcements`, `leaves`, `attendance`, `tasks`, `salary`, `documents`, `support`). Auto-created by `create_default_notification_prefs` on profile creation.
- `user_fcm_tokens` — FCM push registration per user (unique `user_id`), `device_type`, `device_name`, `is_active`.

---

### 3.10 Reporting

#### Generic weekly report (`weekly_reports` family)
- `weekly_reports` — `employee_id`, `week_starting/ending`, `objectives`, `tasks_completed`, `hours_spent`, `status`, `approval_status`, `manager_id`, `submitted_at`, `reviewed_at`.
- Detail tables `weekly_report_tasks`, `weekly_report_goals`, `weekly_report_achievements`, `weekly_report_challenges`, `weekly_report_comments` all reference `report_id`.

#### `uploaded_reports`
Google Drive links posted by employees (`employee_id`, `employee_name`, `report_date`, `file_url`).

---

### 3.11 WES Teacher Reports

- `wes_weekly_reports` — weekly wrapper per teacher (`class_batch`, `week_start_date/end_date`, aggregate metrics).
- `wes_daily_reports` — per-day rollup (`day_name`, `day_date`, attendance counts, parent-call counts, checklist booleans).
- `wes_class_updates` — per class per day (`time_slot`, `class_number`, `unit_name`, `chapter_name`, `learning_outcomes`, `chapters_topics_complete`).
- `wes_lesson_plans` — LP submission tracker.
- `wes_academic_feedback` / `wes_operations_feedback` — daily feedback + rating.
- `wes_challenges` — per weekly report.
- View `wes_weekly_reports_summary` denormalizes for dashboards.

---

### 3.12 Performance

`performance_reviews` — `employee_user_id`, `reviewer_user_id`, `review_period`, `rating`, `strengths`, `areas_of_improvement`, `goals`, `comments`.

---

## 4. Foreign Keys (public → auth / public)

- `announcements.created_by → auth.users(id) SET NULL`
- `appraisals.employee_id → employee_profiles(id) CASCADE`; `uploaded_by → auth.users`
- `assignment_group_members.group_id → assignment_groups CASCADE`; `user_id → auth.users CASCADE`; `added_by → auth.users`
- `attendance.user_id → auth.users CASCADE`; `shift_id → shifts`; `approved_by → auth.users`
- `attendance_audit.attendance_id → attendance CASCADE`
- `attendance_summary.user_id → auth.users CASCADE`
- `company_documents.user_id → auth.users SET NULL`; `updated_by → auth.users`
- `documents.user_id → auth.users CASCADE`; `verified_by → auth.users`
- `document_types.created_by → auth.users SET NULL`
- `employee_profiles.user_id → auth.users CASCADE`
- `employee_shifts.shift_id → shifts CASCADE`; `user_id → employee_profiles(user_id) CASCADE` **and** `→ auth.users CASCADE`
- `individual_peer_reviewers.{task_id → tasks CASCADE, user_id → auth.users CASCADE, reviewer_id → auth.users CASCADE, assigned_by → auth.users SET NULL}`
- `leaves.user_id → auth.users CASCADE`; `approved_by → auth.users`
- `login_history.user_id → auth.users CASCADE`
- `manager_institutions.manager_user_id → auth.users CASCADE`
- `manual_deductions.{user_id → auth.users CASCADE, deduction_type_id → deduction_types, created_by/updated_by → auth.users}`
- `notifications.user_id → auth.users CASCADE`
- `payroll_register.{user_id → auth.users CASCADE, approved_by/created_by/updated_by → auth.users}`
- `peer_reviewer_group_members.group_id → peer_reviewer_groups CASCADE`
- `performance_reviews.employee_user_id → auth.users CASCADE`; `reviewer_user_id → auth.users SET NULL`
- `salaries.user_id → auth.users CASCADE`; `locked_by → auth.users`
- `salary_structures.{user_id → auth.users CASCADE, created_by/updated_by → auth.users}`
- `support_requests.{user_id → auth.users CASCADE, assigned_to/resolved_by → auth.users SET NULL}`
- `support_request_replies.{request_id → support_requests CASCADE, user_id → auth.users CASCADE}`
- `task_*` junction tables cascade from `tasks(id)` / `assignment_groups(id)` / `peer_reviewer_groups(id)` as appropriate; user columns → `auth.users`.
- `earning_types.created_by`, `deduction_types.created_by` → `auth.users`.

(Full DDL for every column lives in the migration history under `supabase/migrations/`.)

---

## 5. Row-Level Security (summary)

RLS is enabled on every user-facing table. Common patterns:

- **Own rows only**: `auth.uid() = user_id` (documents, notifications, own leaves, own attendance insert).
- **Admin escape hatch**: `has_role(auth.uid(), 'admin')` grants ALL on most tables.
- **Manager scoping** via `is_manager_of_user(auth.uid(), target_user_id)` (built on `manager_institutions` + `employee_profiles.institution_assignment`).
- **Public catalogs** (`shifts`, `deduction_types`, `earning_types`, `document_types`, `holidays`, `attendance_rules`, `company_documents`): `SELECT` open, write restricted to admin.
- **Announcements** visible where `is_active AND (is_org_wide OR institution = get_user_institution(auth.uid()))`.
- **Salaries** — employees only see their own **locked** rows; managers see their team while unlocked; admins manage everything.
- **Task remarks / peer reviewer tables** — admin/manager or the assigned peer reviewer (`is_peer_reviewer`) may write remarks; everyone may view.
- **WES report family** — access follows the parent `wes_daily_reports` / `wes_weekly_reports` visibility.

Tables **without** RLS (internal / backup): `attendance_summary`, `attendance_summary_backup`, `weekly_report_achievements`, `weekly_report_challenges`, `weekly_report_comments`, `weekly_report_goals`, `weekly_report_tasks`.

---

## 6. Key Database Functions

Security-definer helpers used throughout policies and app code:

- `has_role(user_id, role) → boolean`
- `is_manager_of_user(manager_id, employee_id) → boolean`
- `is_manager_of_institution(user_id, institution) → boolean`
- `get_user_institution(user_id) → text`
- `is_peer_reviewer(user_id, task_id) → boolean`
- `is_holiday_date(date) → boolean` (Sundays + `holidays` rows)
- `is_late_checkin(ts) → boolean` (>= 11:00 IST)
- `is_within_checkin_window() → boolean` (9:00–11:00 IST)
- `get_employee_shift(user_id, date) → TABLE`

Working-day / attendance math:

- `calculate_working_days(start, end)` and `calculate_monthly_working_days(year, month)`
- `calculate_working_days_for_institution(start, end, institution)`
- `calculate_attendance_stats(user_id, year, month) → json` — canonical stat source used by both Attendance page and Salary edit.
- `calculate_attendance_status(check_in, shift_start, shift_end, ...)`

Absence automation:

- `create_absent_records_for_date(date) → int`
- `create_absent_records_for_range(start, end)`
- `trigger_absent_records_now()`

Leaves:

- `check_leave_eligibility(user, start, end, type, is_emergency) → json`
- `get_or_create_leave_balance(user, year, month)`
- `get_casual_leave_count(user, year, month)`

Holidays:

- `add_holiday(date, name, description, is_national, institution)`
- `update_holiday(...)`, `delete_holiday(date, institution)`
- `sync_holiday_to_attendance(...)`, `sync_holidays_for_new_employee()` (trigger)
- `generate_sundays_for_year(year)`, `auto_add_sundays_for_new_year()` (trigger)

Salary:

- `calculate_salary_components(gross, payroll_days, paid_days, basic_pct, hra_pct)`
- `calculate_statutory_deductions(basic, gross, epf_applicable, esic_applicable, rates...)`
- `calculate_salary_breakdown(base, working_days, present, paid_leave)`
- `generate_monthly_salaries(year, month) → json`

Notifications:

- `notify_user(user_id, type, title, message, related_id)` — respects `notification_preferences`.
- Wrappers: `notify_announcement`, `notify_leave`, `notify_attendance`, `notify_payroll`, `notify_document_verified`, `notify_task_assignment`, `notify_peer_reviewer`, `notify_support_reply` (all triggers).

Groups & misc:

- `get_user_assignment_groups(user)`, `get_assignment_group_members(group)`
- `update_user_email_and_profile(user, new_email)`

Maintenance triggers (all use `update_updated_at_column` / equivalents): `update_appraisals_updated_at`, `update_company_documents_updated_at`, `update_salary_structures_timestamp`, `update_individual_peer_reviewers_updated_at`, `update_earning_structure_updated_at`, `update_uploaded_reports_updated_at`.

Audit / guard triggers: `audit_attendance_changes`, `audit_salary_changes`, `prevent_additional_admins`, `prevent_admin_deletion`, `prevent_absent_on_holidays`, `handle_attendance_checkin`, `validate_leave_request`, `create_default_notification_prefs`.

---

## 7. Views

- `holidays_view` — flat list of holidays (backed by `attendance` rows with `status='holiday'`).
- `payroll_register_view` — denormalized payroll register for exports/dashboards.
- `wes_weekly_reports_summary` — WES weekly report aggregate.

---

## 8. Indexing Highlights

Beyond primary keys and uniqueness constraints, hot-path composite indexes exist on:

- `attendance(user_id, date)`, `attendance(date, user_id)`, partial `attendance(date) WHERE status='holiday'`.
- `salaries(user_id, month, year)`, `salaries(approval_status)`, jsonb GIN on `manual_deductions_details`.
- `payroll_register(user_id, payroll_month)`, `(payroll_month, employee_id)`, `(status)`.
- `manual_deductions(user_id, payroll_month)`, `variable_earnings(user_id, payroll_month)`.
- `tasks(created_by)`, `tasks(display_order)`, `tasks(category)`.
- `task_responses(task_id)`, `task_responses(user_id)`.
- `task_earnings(user_id | task_id | status | earned_at)`.
- `employee_shifts(user_id, effective_from/to)`.
- `notifications(user_id, is_read, created_at)` (via primary key + defaults).
- Face-attendance session lookup by `session_token`, `is_active`, `login_time`, and geolocation.

---

## 9. Data-flow Notes

1. **Attendance is the single source of truth.** Approved leaves are fanned out into `attendance` rows by the `sync_leave_to_attendance` triggers, and holidays are fanned out by `trigger_sync_holiday`. Sundays are auto-inserted for new years. The Attendance page and Salary Edit dialog both read from `calculate_attendance_stats(...)` so counters always match.
2. **Salary generation** consumes `salary_structures` + `calculate_attendance_stats` to fill `salaries`. Once locked, employees can view their record; managers propose adjustments, admins approve.
3. **Notifications** flow: any state change trigger → `notify_user()` → respects `notification_preferences` → inserts into `notifications` + (client-side) FCM push via `user_fcm_tokens`.
4. **Task peer reviews**: admins can attach either individual reviewers, a snapshot of reviewer groups, or both. `is_peer_reviewer(user, task)` is the RLS anchor for who may add remarks to another user's response.
5. **Admin uniqueness**: exactly one row in `user_roles` may have `role='admin'` (currently pinned to `info@wazireducationsocity.com`).

