#!/bin/bash

# =====================================================
# Deploy Face Matching Fix
# =====================================================

echo "🚀 Deploying Face Matching Fix..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "❌ Supabase CLI not found!"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null
then
    echo "❌ Not logged in to Supabase"
    echo "Run: supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Deploy the Edge Function
echo "📦 Deploying face-hub-checkin function..."
supabase functions deploy face-hub-checkin

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Test with 3-5 users"
    echo "2. Run CHECK_FACE_MISMATCH_SIMPLE.sql to verify"
    echo "3. Monitor for 24 hours"
    echo ""
    echo "📖 Read FACE_FIX_HINDI_GUIDE.md for details"
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Try manual deployment:"
    echo "1. Go to Supabase Dashboard → Edge Functions"
    echo "2. Find face-hub-checkin"
    echo "3. Edit and paste code from supabase/functions/face-hub-checkin/index.ts"
    echo "4. Save and Deploy"
    exit 1
fi
