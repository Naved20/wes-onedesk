#!/bin/bash

echo "================================================"
echo "🚨 URGENT: Deploying Face Recognition Fix"
echo "================================================"
echo ""
echo "Issue: False match with distance 0.486"
echo "Fix: Threshold changed from 0.45 to 0.40"
echo ""
echo "================================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "❌ Error: Supabase CLI not found"
    echo "Install it first: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Deploy the face-hub-checkin function
echo "📦 Deploying face-hub-checkin function..."
echo ""

supabase functions deploy face-hub-checkin

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ SUCCESS: Function deployed!"
    echo "================================================"
    echo ""
    echo "New threshold: 0.40 (was 0.45)"
    echo ""
    echo "Next steps:"
    echo "1. Test with enrolled user (should accept if distance < 0.40)"
    echo "2. Test with non-enrolled user (should reject if distance > 0.40)"
    echo "3. Monitor face_checkin_history table for match distances"
    echo ""
    echo "Expected results:"
    echo "  ✅ Distance 0.15-0.35: ACCEPT (good match)"
    echo "  ✅ Distance 0.35-0.40: ACCEPT (borderline)"
    echo "  ❌ Distance 0.40+: REJECT (no match)"
    echo ""
    echo "Your case (0.486) will now be REJECTED ✅"
    echo ""
else
    echo ""
    echo "================================================"
    echo "❌ DEPLOYMENT FAILED"
    echo "================================================"
    echo ""
    echo "Please check:"
    echo "1. Are you logged in? Run: supabase login"
    echo "2. Is the project linked? Run: supabase link"
    echo "3. Check error messages above"
    echo ""
    exit 1
fi
