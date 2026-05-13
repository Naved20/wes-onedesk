# Location Tracking for Face Attendance Sessions

## Overview
Added GPS location tracking to Face Attendance Hub login sessions. Admin can now see where users logged in from with map links and addresses.

## Features Implemented

### 1. Location Permission Request
- Browser asks for location permission on login
- Uses HTML5 Geolocation API
- High accuracy mode enabled
- 10-second timeout for location fetch

### 2. Location Data Captured
**GPS Coordinates:**
- Latitude (decimal degrees)
- Longitude (decimal degrees)
- Accuracy (in meters)

**Reverse Geocoding:**
- Human-readable address using OpenStreetMap Nominatim API
- Full address with street, city, state, country

### 3. Database Schema Updates
**New Columns in `face_attendance_sessions`:**
- `latitude` - DECIMAL(10, 8)
- `longitude` - DECIMAL(11, 8)
- `location_accuracy` - DECIMAL(10, 2) (in meters)
- `location_address` - TEXT (human-readable address)

### 4. Admin Dashboard Display

**Active Sessions Table:**
- "Location" column added
- Shows "View on Map" link (opens Google Maps)
- Displays full address (truncated with tooltip)
- Shows accuracy (±Xm)
- "Not available" if location denied

**Inactive Sessions Table:**
- Compact location display
- Map link
- Shortened address (first 2 parts)

**Logout Dialog:**
- Shows GPS coordinates
- Displays full address
- Included in session details

### 5. Privacy & User Experience

**Permission Handling:**
- Browser shows native permission prompt
- Login proceeds even if location denied
- No blocking - location is optional
- Error handling for denied/unavailable location

**Data Privacy:**
- Location only captured on login
- Stored securely in database
- Only admin can view locations
- RLS policies protect data

## Technical Implementation

### Location Capture Flow
```
1. User clicks Login
   ↓
2. Request location permission
   ↓
3. Get GPS coordinates (if allowed)
   ↓
4. Reverse geocode to address
   ↓
5. Store in database with session
   ↓
6. Continue login (regardless of location result)
```

### APIs Used
- **HTML5 Geolocation API** - GPS coordinates
- **OpenStreetMap Nominatim** - Reverse geocoding (free, no API key)
- **Google Maps** - View location links

### Error Handling
- Location denied → Store null, login continues
- Location timeout → Store null, login continues
- Geocoding fails → Store coordinates only
- Network error → Store null, login continues

## Database Migrations

### Step 1: For New Installations
Run `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql` (already includes location columns)

### Step 2: For Existing Installations
Run `ADD_LOCATION_TO_FACE_SESSIONS.sql` to add location columns

## Files Modified/Created

### Created:
- `ADD_LOCATION_TO_FACE_SESSIONS.sql` - Migration for existing tables
- `LOCATION_TRACKING_FEATURE.md` - This documentation

### Modified:
- `ADD_FACE_ATTENDANCE_SESSIONS_MIGRATION.sql` - Added location columns
- `src/lib/faceSessionManager.ts` - Added `getLocation()` function
- `src/pages/FaceAttendanceSessions.tsx` - Display location in tables

## Admin View Features

### Location Column Shows:
✅ **"View on Map" link** - Opens Google Maps with coordinates
✅ **Full address** - Street, city, state, country
✅ **Accuracy indicator** - ±50m, ±100m, etc.
✅ **Tooltip on hover** - Full address if truncated
✅ **"Not available"** - If location denied/failed

### Map Integration:
- Click "View on Map" opens Google Maps in new tab
- Shows exact login location
- Can see nearby landmarks
- Useful for verifying login location

## Security & Privacy

### User Privacy:
- ⚠️ Location permission required (browser prompt)
- ✅ Optional - login works without location
- ✅ One-time capture (only on login)
- ✅ No continuous tracking

### Admin Access:
- ✅ Only admins can view locations
- ✅ RLS policies enforce access control
- ✅ Audit trail of who logged in from where

### Data Protection:
- ✅ Stored in secure Supabase database
- ✅ HTTPS encrypted transmission
- ✅ No third-party tracking
- ✅ Compliant with privacy standards

## Use Cases

### For Admin:
1. **Verify Login Location** - Ensure employees login from office
2. **Detect Suspicious Activity** - Login from unusual location
3. **Audit Trail** - Track where sessions originated
4. **Remote Work Monitoring** - See if working from home/office

### Example Scenarios:
- Employee logs in from different city → Admin can investigate
- Multiple logins from same location → Verify it's legitimate
- Login from office location → Confirms on-site attendance
- Login accuracy ±5m → High confidence in location

## Browser Compatibility

**Supported:**
- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Opera

**Requirements:**
- HTTPS connection (required for geolocation)
- Location services enabled on device
- Browser permission granted

## Testing

### Test Scenarios:
1. **Allow Location** - Should capture and display location
2. **Deny Location** - Should login without location
3. **Location Timeout** - Should login after 10s timeout
4. **No GPS** - Should login with "Not available"
5. **Admin View** - Should see all location data

### Expected Results:
- Login never blocked by location
- Map links work correctly
- Address displays properly
- Accuracy shown in meters

## Benefits

✅ **Enhanced Security** - Know where logins happen
✅ **Audit Trail** - Complete location history
✅ **Fraud Detection** - Identify suspicious locations
✅ **Compliance** - Track employee locations
✅ **User-Friendly** - Optional, non-blocking
✅ **Privacy-Conscious** - One-time capture only
