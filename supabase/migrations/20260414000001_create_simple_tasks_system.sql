-- Create simple tasks table (like announcements)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  file_url TEXT,
  file_name TEXT
);

-- Create task responses table (employee responses)
CREATE TABLE IF NOT EXISTS task_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  response_text TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One response per user per task
  UNIQUE(task_id, user_id)
);

-- Create task remarks table (admin/manager feedback on responses)
CREATE TABLE IF NOT EXISTS task_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES task_responses(id) ON DELETE CASCADE,
  remarked_by UUID NOT NULL REFERENCES auth.users(id),
  remark_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_task_responses_task_id ON task_responses(task_id);
CREATE INDEX idx_task_responses_user_id ON task_responses(user_id);
CREATE INDEX idx_task_remarks_response_id ON task_remarks(response_id);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_remarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks (everyone can view active tasks)
CREATE POLICY "Everyone can view active tasks"
  ON tasks FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admin and managers can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can update tasks"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can delete tasks"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for task_responses
CREATE POLICY "Users can view all responses"
  ON task_responses FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can create their own responses"
  ON task_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON task_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
  ON task_responses FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for task_remarks
CREATE POLICY "Everyone can view remarks"
  ON task_remarks FOR SELECT
  USING (TRUE);

CREATE POLICY "Admin and managers can create remarks"
  ON task_remarks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can update remarks"
  ON task_remarks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can delete remarks"
  ON task_remarks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_responses_updated_at
  BEFORE UPDATE ON task_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_remarks_updated_at
  BEFORE UPDATE ON task_remarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON task_responses TO authenticated;
GRANT ALL ON task_remarks TO authenticated;
