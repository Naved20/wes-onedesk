# Article/Vocabulary/Notes & Additional File Upload Migration Guide

## Overview
This migration adds support for uploading multiple files in task responses:
1. Link Upload
2. Article/Vocabulary/Notes Upload
3. Additional File Upload

## What's New
- **Three separate upload options** in task submission:
  1. **Link Upload**: For Google Drive, Docs, GitHub, YouTube links, etc.
  2. **Article/Vocabulary/Notes Upload**: For PDF, images, doc files containing articles, vocabulary lists, or handwritten notes
  3. **Additional File Upload**: For any additional supporting files (presentations, spreadsheets, etc.)

## Database Changes
- Adds `article_file_url` column to `task_responses` table
- Adds `article_file_name` column to `task_responses` table
- Adds `additional_file_url` column to `task_responses` table
- Adds `additional_file_name` column to `task_responses` table

## Migration Steps

### 1. Run the SQL Migration
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `ADD_ARTICLE_UPLOAD_MIGRATION.sql`
4. Copy and paste the SQL content
5. Click **Run** to execute the migration

### 2. Verify the Migration
After running the migration, verify the columns were added:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'task_responses'
AND column_name IN ('article_file_url', 'article_file_name', 'additional_file_url', 'additional_file_name');
```

You should see all four columns listed.

### 3. Test the Feature
1. Log in as an employee
2. Open any task
3. Click "Submit Response"
4. You should see:
   - Response/Notes text area (required)
   - Link Upload field (optional)
   - Article/Vocabulary/Notes Upload field (optional)
   - Additional File Upload field (optional)
5. Test submitting with various combinations:
   - Only text
   - Text + link
   - Text + article file
   - Text + additional file
   - Text + link + article file
   - Text + link + article file + additional file

## Storage Buckets
The uploaded files are stored in the `task-responses` bucket:
- Article files: `task-responses/articles/` folder
- Additional files: `task-responses/additional/` folder

Make sure the `task-responses` storage bucket exists and has proper RLS policies:
- Employees can upload files
- Employees can read their own files
- Admins and reviewers can read all files

## File Types Supported

### Article/Vocabulary/Notes Upload:
- Images (jpg, png, gif, etc.)
- PDF documents
- Word documents (.doc, .docx)
- Text files (.txt)

### Additional File Upload:
- All of the above, plus:
- PowerPoint presentations (.ppt, .pptx)
- Excel spreadsheets (.xls, .xlsx)

## Rollback (if needed)
If you need to rollback this migration:
```sql
ALTER TABLE task_responses
DROP COLUMN IF EXISTS article_file_url,
DROP COLUMN IF EXISTS article_file_name,
DROP COLUMN IF EXISTS additional_file_url,
DROP COLUMN IF EXISTS additional_file_name;
```

## Notes
- All upload fields are **optional**
- Employees can submit with just text, or any combination of link and files
- The response text field is still **required**
- Files are stored in separate folders for better organization
- Maximum flexibility for employees to submit their work in any format
