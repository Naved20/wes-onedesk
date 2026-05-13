# Face Attendance Session Management System

## Overview
Complete session tracking and management system for Face Attendance Hub that allows admins to monitor all active devices and remotely logout users.

## Features Implemented

### 1. Database Schema
**Table**: `face_attendance_sessions`
- Tracks all login sessions with device information
- Stores IP address, browser, OS, device type
- Records login time, last activity, and logout time
- Supports admin-forced logout with reason tracking

### 2. Session Management Library
**File**: `src/lib/faceSessionManager.ts`

**Functions**:
- `createFaceSession()` - Creates new session on login
- `updateSessionActivity()` - Updates last activity timestamp
- `logoutFaceSession()` - Logs out a session
- `isSessionValid()` - Checks if session is still active
- `getAllSessions()` - Admin: Get all sessions
- `adminLogoutSession()` - Admin: Force logout a device

**Device Detection**:
- Browser: Chrome, Safari, Firefox, Edge, Opera
- OS: Windows, macOS, Linux, Android, iOS
- Device Type: Desktop, Mobile, Tablet
- IP Address: Fetched from public API

### 3. Admin Dashboard
**Page**: `/face-sessions` (Admin only)

**Features**:
- View all active sessions in real-time
- See device info, browser, OS, IP address
- Track login time and last activity
- Calculate session duration
- Force logout any device remotely
- View inactive session history
- Auto-refresh capability

**Displayed Information**:
- Device type with icon (Desktop/Mobile/Tablet)
- Browser name and version
- Operating system
- IP address with location icon
- Login timestamp
- Last activity (relative time)
- Total session duration
- Logout reason for inactive sessions

### 4. Updated Login Flow

**FaceAttendanceAuth.tsx**:
- Creates session token on successful login
- Stores token in localStorage
- Tracks device info and IP address

**FaceHub.tsx**:
- Validates session on page load
- Updates activity every 30 seconds
- Checks if admin has logged out the session
- Handles logout with session cleanup

**Auth.tsx**:
- Also creates session for Face Hub login
- Supports both login methods

### 5. Session Validation
- Checks session validity on page load
- If admin logs out session, user is redirected to login
- Shows toast notification when session is terminated
- Automatic cleanup of old inactive sessions (30+ days)

## Database Migration

**File**: `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql`

Run this in Supabase SQL Editor to create:
1. `face_attendance_sessions` table
2. Indexes for performance
3. RLS policies for security
4. Cleanup function for old sessions

## Usage

### For Admin:
1. Navigate to `/face-sessions` in the dashboard
2. View all active Face Hub sessions
3. See device details, login time, and activity
4. Click "Logout" to force logout any device
5. View inactive session history

### For Face Hub Users:
- Login creates a tracked session
- Activity is updated automatically
- If admin logs out the session, user is redirected to login
- Manual logout properly closes the session

## Security Features

1. **RLS Policies**: Only admins can view/manage sessions
2. **Session Tokens**: Unique tokens for each login
3. **Activity Tracking**: Last activity timestamp updated every 30s
4. **Remote Logout**: Admin can terminate any session
5. **Automatic Cleanup**: Old sessions removed after 30 days

## Session Lifecycle

```
1. User Login
   ↓
2. Create Session (device info, IP, timestamp)
   ↓
3. Store Token in localStorage
   ↓
4. Update Activity Every 30s
   ↓
5. Admin Can View/Logout
   ↓
6. User Logout or Admin Force Logout
   ↓
7. Session Marked Inactive
```

## API Endpoints Used

- **IP Detection**: `https://api.ipify.org?format=json`
- **Supabase**: `face_attendance_sessions` table

## Files Modified/Created

### Created:
- `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql`
- `src/lib/faceSessionManager.ts`
- `src/pages/FaceAttendanceSessions.tsx`
- `FACE_ATTENDANCE_SESSION_MANAGEMENT.md`

### Modified:
- `src/pages/FaceAttendanceAuth.tsx`
- `src/pages/FaceHub.tsx`
- `src/pages/Auth.tsx`
- `src/App.tsx`

## Next Steps

1. Run the database migration in Supabase
2. Test login and session creation
3. Test admin dashboard at `/face-sessions`
4. Test remote logout functionality
5. Monitor session activity tracking

## Benefits

✅ **Complete Visibility**: Admin sees all active Face Hub sessions
✅ **Device Tracking**: Know which devices are logged in
✅ **Security Control**: Force logout suspicious sessions
✅ **Activity Monitoring**: Track last activity timestamps
✅ **Session History**: View past login/logout records
✅ **Unlimited Sessions**: No automatic expiry (admin controlled)
