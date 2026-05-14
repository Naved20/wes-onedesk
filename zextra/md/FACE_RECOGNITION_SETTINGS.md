# Face Recognition Settings Guide

## Overview
Face recognition system uses euclidean distance to match faces. Lower distance = better match.

## Current Configuration

### 1. Match Threshold: **0.45**
- **Location**: 
  - `src/lib/faceApi.ts` (line 48)
  - `supabase/functions/face-hub-checkin/index.ts` (line 8)
- **What it does**: Maximum distance allowed for a successful match
- **Lower value** = Stricter matching (fewer false positives, but may reject valid users)
- **Higher value** = Lenient matching (more false positives, accepts more variations)

**Recommended Values:**
- **0.40-0.45**: Very strict (best for high security, may need re-enrollment in different lighting)
- **0.45-0.50**: Balanced (recommended for most cases)
- **0.50-0.60**: Lenient (good for varying lighting conditions)
- **0.60+**: Too lenient (high risk of false matches) ❌

### 2. Face Detection Score Threshold: **0.5**
- **Location**: `src/lib/faceApi.ts` (line 25)
- **What it does**: Minimum confidence required to detect a face
- **Lower value** = Detects faces more easily (may detect non-faces)
- **Higher value** = Only detects clear, well-lit faces

**Recommended Values:**
- **0.3-0.4**: Very lenient (detects faces in poor lighting)
- **0.4-0.5**: Balanced
- **0.5-0.6**: Strict (requires good lighting and clear face) ✅ Current
- **0.6+**: Very strict (may miss valid faces)

### 3. Face Descriptor Averaging
- **Location**: `src/pages/FaceHub.tsx` (line 133)
- **Current**: Takes 7 samples with 160ms delay between each
- **What it does**: Averages multiple face scans to reduce impact of temporary variations (blinks, slight movements, lighting changes)

**Parameters:**
```typescript
getAveragedFaceDescriptor(video, attempts=7, delayMs=160)
```

**Recommended Values:**
- **attempts**: 5-10 (more = more accurate but slower)
- **delayMs**: 100-200ms (time between captures)

## Troubleshooting

### Problem: Too many false matches (wrong person recognized)
**Solution**: Decrease `MATCH_THRESHOLD`
- Try: 0.40 or 0.42
- Re-test with multiple users

### Problem: Valid users not being recognized
**Solution**: Increase `MATCH_THRESHOLD` slightly
- Try: 0.48 or 0.50
- Check lighting conditions
- Consider re-enrolling faces with better quality images

### Problem: "No face detected" errors
**Solution**: Decrease `scoreThreshold` in face detection
- Try: 0.4 or 0.45
- Improve lighting in check-in area
- Ensure camera quality is good

### Problem: Inconsistent results
**Solution**: 
1. Increase averaging attempts (try 10 instead of 7)
2. Ensure consistent lighting during enrollment and check-in
3. Re-enroll faces with multiple angles and lighting conditions

## Best Practices

1. **Enrollment**:
   - Use good, consistent lighting
   - Face should be clearly visible
   - No glasses, masks, or obstructions (if possible)
   - Take multiple samples from slightly different angles

2. **Check-in Environment**:
   - Maintain consistent lighting
   - Position camera at face level
   - Ensure adequate distance (not too close or far)
   - Avoid backlighting (light source behind person)

3. **Testing**:
   - Test with multiple users
   - Test in different lighting conditions
   - Monitor false positive and false negative rates
   - Adjust thresholds based on real-world results

## Current Changes Made

✅ **MATCH_THRESHOLD**: Changed from 0.68 → 0.45 (much stricter)
✅ **scoreThreshold**: Changed from 0.35 → 0.5 (better face detection quality)

These changes should significantly reduce false matches while maintaining good recognition for enrolled users.

## Monitoring

Check the face check-in history to monitor:
- Match distances for successful check-ins
- Failed attempts and their distances
- Adjust thresholds based on this data

**Good match distances**: 0.20-0.40
**Borderline**: 0.40-0.45
**Should reject**: 0.45+
