# Deploy Edge Function - reset-leave-balances

## Prerequisites
- Supabase CLI installed
- Access to Supabase project (cyfcfrgrzcmbweviogrn)
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY available

## Deployment Steps

### 1. Install Supabase CLI (if not already installed)
```powershell
npm install -g supabase
```

### 2. Verify Project Connection
```powershell
supabase status
```

### 3. Deploy the Edge Function
```powershell
supabase functions deploy reset-leave-balances
```

### 4. Set Environment Variables (if needed)
The Edge Function requires these environment variables (should be set in Supabase):
- `SUPABASE_URL`: Already configured
- `SUPABASE_SERVICE_ROLE_KEY`: Get from Supabase Project Settings > API

### 5. Verify Deployment
```powershell
supabase functions list
```

You should see `reset-leave-balances` in the list.

## Testing the Deployment

### Via Supabase Dashboard
1. Go to https://app.supabase.com
2. Select project: cyfcfrgrzcmbweviogrn
3. Navigate to Edge Functions
4. Find `reset-leave-balances`
5. Test with payload:
```json
{
  "trigger_type": "manual",
  "frequency": "monthly",
  "carryForwardEnabled": true,
  "maxCarryForward": 5,
  "carryForwardExpiry": 365
}
```

### Via cURL
```bash
curl -X POST https://cyfcfrgrzcmbweviogrn.supabase.co/functions/v1/reset-leave-balances \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_type": "manual",
    "frequency": "monthly",
    "carryForwardEnabled": true,
    "maxCarryForward": 5
  }'
```

### Via React App
The Manual Reset button in BalanceResetSettings component should work:
1. Login as Admin
2. Navigate to Admin > Leave Balance > Balance Reset Configuration
3. Click "Reset Now" button
4. Check notifications table for audit entries

## Function Details

**Name**: reset-leave-balances
**Location**: supabase/functions/reset-leave-balances/index.ts
**Auth Required**: Yes (Admin role)
**Method**: POST

### Request Body
```typescript
{
  trigger_type: "manual" | "scheduled",
  frequency?: string,
  carryForwardEnabled?: boolean,
  maxCarryForward?: number,
  carryForwardExpiry?: number
}
```

### Response
```typescript
{
  success: true,
  employees_affected: number,
  leaves_carried_forward: number,
  reset_date: string (ISO 8601),
  message: string
}
```

### What It Does
1. Authenticates user (must be admin)
2. Fetches all active employees
3. For each employee:
   - Calculates unused leaves from previous period
   - Applies carry forward logic if enabled
   - Resets current month balance
   - Creates notification
4. Logs audit entry in leave_reset_history
5. Updates leave_reset_settings with last/next reset dates

### Error Handling
- Returns 401 if not authenticated
- Returns 403 if not admin
- Returns 500 if reset fails (with error details)
- Logs failures to leave_reset_history table

## Database Tables Used
- `employee_profiles`: Get active employees
- `leave_balances`: Reset balances per employee per month
- `leave_reset_settings`: Get reset configuration
- `leave_reset_history`: Audit trail of resets
- `notifications`: Send notifications to employees

## Troubleshooting

### "Function not found" error
- Verify function is deployed: `supabase functions list`
- Check function URL is correct
- Ensure auth token is valid

### "Authorization failed" error
- Verify user is logged in
- Check user has admin role in user_roles table
- Ensure access_token hasn't expired

### "No employees to reset" warning
- Verify employee_profiles table has active employees
- Check is_active = true for employees

### Notifications not showing
- Verify notifications table exists
- Check user_id values match
- Verify notification permission is granted

## Next Steps
1. Deploy this function: `supabase functions deploy reset-leave-balances`
2. Test manual reset from BalanceResetSettings UI
3. Verify notifications appear for employees
4. Check leave_reset_history for audit trail
5. Set up scheduler (pg_cron, Vercel Cron, etc.) - see SCHEDULER_SETUP.md

## Documentation
- SCHEDULER_SETUP.md: How to schedule automatic resets
- TESTING_GUIDE.md: Manual testing procedures
- IMPLEMENTATION_SUMMARY.md: Architecture overview
