# 🔧 Face Fix - Quick Reference

## Problem
- Frontend: Correct person ✅
- Backend: Wrong person attendance ❌
- History: Wrong person name ❌

## Solution
Updated `supabase/functions/face-hub-checkin/index.ts`:
- Threshold: 0.40 → 0.30 (stricter)
- Added confidence check (second-best must be 0.20+ worse)

## Deploy Now!


### Option 1: Command Line
```bash
bash deploy-face-fix.sh
```

### Option 2: Supabase Dashboard
1. Go to **Edge Functions**
2. Find `face-hub-checkin`
3. Click **Edit**
4. Copy code from `supabase/functions/face-hub-checkin/index.ts`
5. Paste and **Deploy**

### Option 3: Manual CLI
```bash
supabase functions deploy face-hub-checkin
```

## Verify Fix

### Quick Check (Run in Supabase SQL Editor)
```sql
-- Find mismatches (should return 0 rows after fix)
SELECT 
  fch.user_id as history_user,
  a.user_id as attendance_user
FROM face_checkin_history fch
LEFT JOIN attendance a ON fch.attendance_id = a.id
WHERE fch.matched = true
  AND fch.user_id != a.user_id
  AND fch.created_at > NOW() - INTERVAL '1 hour';
```

**Expected**: 0 rows (no mismatches)

### Match Quality Check
```sql
-- Check match distances
SELECT 
  matched,
  COUNT(*) as count,
  AVG(match_distance) as avg_distance
FROM face_checkin_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY matched;
```

**Expected**:
- Matched: avg_distance < 0.25
- Not Matched: avg_distance > 0.35

## Test After Deploy

1. **Test 1**: Scan registered person → Should mark correct attendance ✅
2. **Test 2**: Scan unregistered person → Should show "Not Enrolled" ❌
3. **Test 3**: Run verification SQL → Should show 0 mismatches ✅

## If Users Get Rejected

Re-enroll with better quality:
- ✅ Good lighting (front-facing)
- ✅ Clear face (no glasses/mask)
- ✅ Look directly at camera
- ✅ Neutral expression

## Files

- 📖 **FACE_FIX_HINDI_GUIDE.md** - Detailed Hindi guide
- 📋 **DEPLOY_FACE_FIX.md** - Full deployment guide
- 🔍 **CHECK_FACE_MISMATCH_SIMPLE.sql** - Simple verification queries
- 🔧 **deploy-face-fix.sh** - Deployment script

## Support

Run these if issues persist:
```bash
# Check queries
cat CHECK_FACE_MISMATCH_SIMPLE.sql

# View deployment guide
cat DEPLOY_FACE_FIX.md

# Read Hindi guide
cat FACE_FIX_HINDI_GUIDE.md
```

---

**IMPORTANT**: Deploy immediately to fix wrong attendance issue!
