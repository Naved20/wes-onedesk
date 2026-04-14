-- Create task status enum
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'completed', 'cancelled');

-- Create task priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  
  -- Assignment
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Dates
  due_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Organization
  tags TEXT[],
  category TEXT,
  institution TEXT,
  
  -- Attachments and links
  attachments JSONB DEFAULT '[]'::jsonb,
  related_links TEXT[],
  
  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create task activity log table
CREATE TABLE IF NOT EXISTS task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_created_by ON tasks(created_by) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_status ON tasks(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_priority ON tasks(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_institution ON tasks(institution) WHERE is_deleted = FALSE;
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_task_activity_task_id ON task_activity(task_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to log task activity
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.assigned_to, 'status_changed', OLD.status::TEXT, NEW.status::TEXT);
  END IF;
  
  -- Log assignment changes
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.assigned_to, 'assigned', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  
  -- Log priority changes
  IF TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.assigned_to, 'priority_changed', OLD.priority::TEXT, NEW.priority::TEXT);
  END IF;
  
  -- Log completion
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    UPDATE tasks SET completed_at = NOW() WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task activity logging
CREATE TRIGGER log_task_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_activity();

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks assigned to them or created by them"
  ON tasks FOR SELECT
  USING (
    auth.uid() = assigned_to OR 
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tasks or assigned tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Only admins can delete tasks"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments on tasks they can access"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_comments.task_id 
      AND (
        tasks.assigned_to = auth.uid() OR 
        tasks.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Users can create comments on tasks they can access"
  ON task_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_comments.task_id 
      AND (
        tasks.assigned_to = auth.uid() OR 
        tasks.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON task_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON task_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for task_activity
CREATE POLICY "Users can view activity on tasks they can access"
  ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_activity.task_id 
      AND (
        tasks.assigned_to = auth.uid() OR 
        tasks.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'manager')
        )
      )
    )
  );

-- Grant permissions
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON task_comments TO authenticated;
GRANT ALL ON task_activity TO authenticated;
