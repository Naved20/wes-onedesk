-- Create storage buckets for tasks and responses
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tasks', 'tasks', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-responses', 'task-responses', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tasks bucket
DROP POLICY IF EXISTS "Anyone can upload to tasks bucket" ON storage.objects;
CREATE POLICY "Anyone can upload to tasks bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tasks' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view tasks files" ON storage.objects;
CREATE POLICY "Anyone can view tasks files"
ON storage.objects FOR SELECT
USING (bucket_id = 'tasks');

DROP POLICY IF EXISTS "Anyone can delete tasks files" ON storage.objects;
CREATE POLICY "Anyone can delete tasks files"
ON storage.objects FOR DELETE
USING (bucket_id = 'tasks' AND auth.role() = 'authenticated');

-- Storage policies for task-responses bucket
DROP POLICY IF EXISTS "Anyone can upload to task-responses bucket" ON storage.objects;
CREATE POLICY "Anyone can upload to task-responses bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-responses' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view task-responses files" ON storage.objects;
CREATE POLICY "Anyone can view task-responses files"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-responses');

DROP POLICY IF EXISTS "Anyone can delete task-responses files" ON storage.objects;
CREATE POLICY "Anyone can delete task-responses files"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-responses' AND auth.role() = 'authenticated');
