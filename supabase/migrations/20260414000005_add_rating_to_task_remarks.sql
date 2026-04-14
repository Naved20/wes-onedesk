-- Add rating column to task_remarks table
ALTER TABLE task_remarks
ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);
