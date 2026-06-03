## Goal
Merge `holidays` table into `attendance` table so there's one source of truth and no conflicts between holiday entries and attendance entries.

## Approach
Holidays will live **as attendance rows** with `status = 'holiday'`. When admin adds a holiday for an institution (or all), the system fans it out to every matching user as an attendance row. The `holidays` table is dropped.

## Schema changes (migration)

1. Add columns to `public.attendance`:
   - `holiday_name TEXT` — populated only for holiday rows
   - `holiday_description TEXT`
   - `is_national BOOLEAN DEFAULT false`
   - `institution_name TEXT` — denormalized for filtering / admin views
2. Index: `CREATE INDEX idx_attendance_holiday ON attendance(date) WHERE status = 'holiday';`
3. New SECURITY DEFINER functions:
   - `add_holiday(p_date, p_name, p_description, p_is_national, p_institution)` — inserts/updates an attendance row with `status='holiday'` for every active employee in the target institution (or all institutions if NULL). Skips users who already have an `approved` present/half-day for that date (to avoid wiping real attendance).
   - `update_holiday(p_date, p_old_institution, p_name, p_description, p_is_national, p_new_institution)` — updates all matching holiday rows; handles institution re-scoping.
   - `delete_holiday(p_date, p_institution)` — deletes only holiday rows for that date+scope.
   - `list_holidays()` view: distinct `(date, holiday_name, holiday_description, is_national, institution_name)` from attendance where `status='holiday'`.
4. Backfill: copy existing `holidays` rows into attendance via `add_holiday(...)` then `DROP TABLE public.holidays`.
5. Trigger on `employee_profiles` insert: when a new user joins, auto-create their holiday attendance rows from existing holiday dates in their institution.

## Frontend changes

- `src/components/attendance/HolidayManager.tsx`: switch from `from('holidays')` to RPCs `add_holiday`, `update_holiday`, `delete_holiday`, and read via the `list_holidays` view. UI stays the same.
- `src/integrations/supabase/types.ts`: regenerated after migration.
- Any other reads of `holidays` table → switch to the view.

## Conflict resolution rules
- Holiday rows have `status='holiday'`, `is_manual_override=false`.
- If a user already checked in (`approved` + present/half_day), holiday is **not** overwritten — their attendance wins.
- If a leave is approved on the same date, leave wins over holiday.
- Salary/stats calculations already treat `holiday` status correctly.

## Risk
- Holiday rows multiply by employee count — but attendance already has daily rows per user, so this is consistent.
- One-time backfill copies historical holidays into existing employees' attendance.

Approve to proceed with migration + code changes.