-- Add rating category columns to task_remarks table
-- This allows detailed feedback on different parameters

-- Add new columns for rating categories
ALTER TABLE public.task_remarks 
ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 5 CHECK (confidence >= 1 AND confidence <= 5),
ADD COLUMN IF NOT EXISTS vocabulary INTEGER DEFAULT 5 CHECK (vocabulary >= 1 AND vocabulary <= 5),
ADD COLUMN IF NOT EXISTS tone INTEGER DEFAULT 5 CHECK (tone >= 1 AND tone <= 5),
ADD COLUMN IF NOT EXISTS hand_gesture INTEGER DEFAULT 5 CHECK (hand_gesture >= 1 AND hand_gesture <= 5),
ADD COLUMN IF NOT EXISTS speed INTEGER DEFAULT 5 CHECK (speed >= 1 AND speed <= 5);

-- Add comments for documentation
COMMENT ON COLUMN public.task_remarks.confidence IS 'Rating for confidence level (1-5)';
COMMENT ON COLUMN public.task_remarks.vocabulary IS 'Rating for vocabulary usage (1-5)';
COMMENT ON COLUMN public.task_remarks.tone IS 'Rating for tone/voice quality (1-5)';
COMMENT ON COLUMN public.task_remarks.hand_gesture IS 'Rating for hand gestures (1-5)';
COMMENT ON COLUMN public.task_remarks.speed IS 'Rating for speaking/delivery speed (1-5)';

-- Update existing remarks to have default values (if any exist with NULL)
UPDATE public.task_remarks
SET 
  confidence = COALESCE(confidence, rating, 5),
  vocabulary = COALESCE(vocabulary, rating, 5),
  tone = COALESCE(tone, rating, 5),
  hand_gesture = COALESCE(hand_gesture, rating, 5),
  speed = COALESCE(speed, rating, 5)
WHERE confidence IS NULL 
   OR vocabulary IS NULL 
   OR tone IS NULL 
   OR hand_gesture IS NULL 
   OR speed IS NULL;

-- Verify the changes
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'task_remarks'
AND column_name IN ('confidence', 'vocabulary', 'tone', 'hand_gesture', 'speed')
ORDER BY column_name;
