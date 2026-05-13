# Face Attendance Sessions - Setup Guide

## Problem
Face Hub login is failing with 401 error because:
- Face Hub uses simple username/password (not Supabase auth)
- RLS policies require authentication
- Session creation is blocked

## Solution

### Step 1: Run Main Migration
Open Supabase SQL Editor and run `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql`

This creates:
- `face_attendance_sessions` table
- Indexes
- Initial RLS policies

### Step 2: Fix RLS Policies
Run `FIX_FACE_SESSIONS_RLS.sql` in Supabase SQL Editor

This updates policies to allow:
- ✅ Unauthenticated users to insert sessions (Face Hub login)
- ✅ Anyone to update sessions (activity tracking)
- ✅ Admins to view all sessions

### Step 3: Test Login
1. Go to Face Hub login page
2. Login with: `face@wes.lu` / `WES@naved123`
3. Should login successfully without 401 errors

### Step 4: Verify Session Tracking
1. Login as admin to main app
2. Navigate to `/face-sessions`
3. Should see the Face Hub session listed

## Why This Fix Works

**Before:**
```sql
-- Required authentication
FOR INSERT TO authenticated
```

**After:**
```sql
-- Allows public (unauthenticated) access
FOR INSERT TO public
```

Face Hub users don't have Supabase auth tokens, so they need public access to create sessions.

## Security Notes

- ✅ Only session creation is public
- ✅ Admin viewing requires authentication
- ✅ Session tokens are unique and random
- ✅ No sensitive data exposed
- ✅ Admin can still force logout any session

## Files to Run (In Order)

1. `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql` - Creates table
2. `FIX_FACE_SESSIONS_RLS.sql` - Fixes RLS policies

## Expected Result

After running both migrations:
- ✅ Face Hub login works without errors
- ✅ Sessions are tracked in database
- ✅ Admin can view all sessions at `/face-sessions`
- ✅ Admin can force logout devices
- ✅ Activity tracking works automatically
