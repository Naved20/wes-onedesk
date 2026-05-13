# Fix Employee Document Download Issue

## Problem
Admin employee ke liye document upload kar sakta hai, but download nahi ho raha tha. Error tha:
```
{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}
```

## Root Cause
1. **Bucket missing**: `employee-documents` storage bucket Supabase mein exist nahi karta tha
2. **Download method**: Direct URL se download try ho raha tha instead of proper storage API

## Solution Applied

### 1. Database Migration Created
**File**: `FIX_EMPLOYEE_DOCUMENTS_BUCKET.sql`

This migration:
- ✅ Creates `employee-documents` storage bucket (public)
- ✅ Sets up RLS policies:
  - Users can view/download their own documents
  - Admins can view/download all documents
  - Admins can upload/update/delete documents
  - Users can delete their own documents

### 2. Download Logic Fixed
**File**: `src/components/employee/MyDocuments.tsx`

Changed from:
```tsx
// ❌ Old - Direct link download (fails if bucket not public)
<a href={document.file_url} download={document.document_name}>
  <Download />
</a>
```

To:
```tsx
// ✅ New - Proper storage API download
onClick={async () => {
  const { data, error } = await supabase.storage
    .from('employee-documents')
    .download(filePath);
  
  // Create blob and trigger download
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = document.document_name;
  a.click();
}}
```

### 3. Dialog Warning Fixed
Added `DialogDescription` to remove React warning.

---

## How to Apply Fix

### Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `FIX_EMPLOYEE_DOCUMENTS_BUCKET.sql`
3. Execute the migration
4. Verify bucket created:
   - Go to Storage section
   - You should see `employee-documents` bucket

### Step 2: Verify Bucket Settings

In Supabase Storage:
1. Click on `employee-documents` bucket
2. Check settings:
   - ✅ Public bucket: **Yes** (for easier access)
   - ✅ File size limit: Set as needed (default 50MB)
   - ✅ Allowed MIME types: All or specific (pdf, images, docs)

### Step 3: Test the Fix

#### As Admin:
1. Go to Employee Profile page
2. Click "Upload Document"
3. Upload a test file (PDF, image, etc.)
4. Click download button
5. ✅ File should download successfully

#### As Employee:
1. Go to your profile
2. View "My Documents" section
3. Click download on any document
4. ✅ File should download successfully

---

## How It Works Now

### Upload Flow:
1. Admin selects file
2. File uploaded to: `employee-documents/{userId}/{randomUUID}.{ext}`
3. Public URL stored in database
4. ✅ Upload successful

### Download Flow:
1. User clicks download button
2. Extract file path from URL
3. Call `supabase.storage.from('employee-documents').download(filePath)`
4. Create blob from downloaded data
5. Trigger browser download
6. ✅ Download successful

### Fallback:
If storage download fails, it falls back to direct URL download:
```tsx
if (error) {
  window.open(document.file_url, '_blank');
}
```

---

## Troubleshooting

### Issue: Still getting 404 error
**Solution**: 
- Verify bucket exists in Supabase Storage
- Check bucket name is exactly `employee-documents`
- Run migration again if needed

### Issue: Download button not working
**Solution**:
- Check browser console for errors
- Verify RLS policies are set correctly
- Check if user has permission to access the file

### Issue: File downloads but is corrupted
**Solution**:
- Check MIME type in storage settings
- Verify file was uploaded correctly
- Try re-uploading the file

### Issue: Permission denied
**Solution**:
- Check RLS policies in migration
- Verify user role in `user_roles` table
- For employees: verify `userId` matches folder name in storage

---

## Security Notes

### RLS Policies Explained:

1. **Users can view their own documents**:
   - Checks if folder name matches user ID
   - Path: `employee-documents/{userId}/file.pdf`
   - Only that user can access

2. **Admins can view all documents**:
   - Checks if user has 'admin' role
   - Can access any file in bucket

3. **Upload/Update/Delete**:
   - Only admins can perform these operations
   - Prevents unauthorized modifications

### Best Practices:
- ✅ Keep bucket public for easier access
- ✅ Use RLS policies for security
- ✅ Store files in user-specific folders
- ✅ Use UUIDs for file names (prevent conflicts)
- ✅ Store original filename in database

---

## Files Modified

1. **FIX_EMPLOYEE_DOCUMENTS_BUCKET.sql** (NEW)
   - Creates storage bucket
   - Sets up RLS policies

2. **src/components/employee/MyDocuments.tsx**
   - Fixed download logic
   - Added proper error handling
   - Added fallback mechanism
   - Fixed Dialog warning

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] `employee-documents` bucket exists in Storage
- [ ] Admin can upload documents
- [ ] Admin can download documents
- [ ] Employee can view their documents
- [ ] Employee can download their documents
- [ ] Download works for PDF files
- [ ] Download works for image files
- [ ] Download works for other file types
- [ ] No console errors
- [ ] No React warnings

---

## Additional Features

### Future Enhancements:
1. **Preview before download**: Show file preview in modal
2. **Bulk download**: Download multiple files as ZIP
3. **File versioning**: Keep history of document updates
4. **Expiry dates**: Auto-delete old documents
5. **File categories**: Organize by document type
6. **Search/Filter**: Find documents quickly

---

## Support

If issues persist:
1. Check Supabase logs (Dashboard → Logs)
2. Verify storage bucket configuration
3. Check RLS policies are active
4. Test with different file types
5. Check browser console for detailed errors
