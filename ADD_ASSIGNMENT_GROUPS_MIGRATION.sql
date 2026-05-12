-- Create assignment_groups table
CREATE TABLE IF NOT EXISTS public.assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assignment_group_members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.assignment_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);


-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_groups_active ON public.assignment_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_name ON public.assignment_groups(name);
CREATE INDEX IF NOT EXISTS idx_assignment_group_members_group ON public.assignment_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_group_members_user ON public.assignment_group_members(user_id);

-- Enable RLS
ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignment_groups

-- Admins and managers can view all groups
CREATE POLICY "Admins and managers can view assignment groups"
  ON public.assignment_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Employees can view groups they are members of
CREATE POLICY "Employees can view their assignment groups"
  ON public.assignment_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_group_members
      WHERE assignment_group_members.group_id = assignment_groups.id
      AND assignment_group_members.user_id = auth.uid()
    )
  );

-- Only admins can create groups
CREATE POLICY "Admins can create assignment groups"
  ON public.assignment_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update groups
CREATE POLICY "Admins can update assignment groups"
  ON public.assignment_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete groups
CREATE POLICY "Admins can delete assignment groups"
  ON public.assignment_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies for assignment_group_members

-- Admins and managers can view all members
CREATE POLICY "Admins and managers can view assignment group members"
  ON public.assignment_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Employees can view members of groups they belong to
CREATE POLICY "Employees can view their group members"
  ON public.assignment_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_group_members agm
      WHERE agm.group_id = assignment_group_members.group_id
      AND agm.user_id = auth.uid()
    )
  );

-- Only admins can add members
CREATE POLICY "Admins can add assignment group members"
  ON public.assignment_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can remove members
CREATE POLICY "Admins can remove assignment group members"
  ON public.assignment_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE public.assignment_groups IS 'Groups for organizing employees for task assignments and team management';
COMMENT ON TABLE public.assignment_group_members IS 'Members belonging to assignment groups';

-- Function to get group members with employee details
CREATE OR REPLACE FUNCTION get_assignment_group_members(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  designation TEXT,
  institution_assignment TEXT,
  added_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.user_id,
    ep.first_name,
    ep.last_name,
    ep.email,
    ep.designation,
    ep.institution_assignment,
    agm.added_at
  FROM public.assignment_group_members agm
  JOIN public.employee_profiles ep ON agm.user_id = ep.user_id
  WHERE agm.group_id = p_group_id
  AND ep.is_active = TRUE
  ORDER BY ep.first_name, ep.last_name;
END;
$$;

-- Function to get groups for a user
CREATE OR REPLACE FUNCTION get_user_assignment_groups(p_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  group_description TEXT,
  member_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ag.id,
    ag.name,
    ag.description,
    COUNT(agm.user_id) as member_count
  FROM public.assignment_groups ag
  JOIN public.assignment_group_members agm ON ag.id = agm.group_id
  WHERE agm.user_id = p_user_id
  AND ag.is_active = TRUE
  GROUP BY ag.id, ag.name, ag.description
  ORDER BY ag.name;
END;
$$;

-- Create task_assignment_groups table to track which groups are assigned to tasks
CREATE TABLE IF NOT EXISTS public.task_assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, group_id)
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_task_assignment_groups_task ON public.task_assignment_groups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignment_groups_group ON public.task_assignment_groups(group_id);

-- Enable RLS
ALTER TABLE public.task_assignment_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_assignment_groups
CREATE POLICY "Users can view task assignment groups"
  ON public.task_assignment_groups
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins and managers can manage task assignment groups"
  ON public.task_assignment_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

COMMENT ON TABLE public.task_assignment_groups IS 'Tracks which assignment groups are assigned to tasks';
