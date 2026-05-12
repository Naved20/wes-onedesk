-- Create task_assignment_groups table to track which groups are assigned to tasks
CREATE TABLE IF NOT EXISTS public.task_assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignment_groups_task ON public.task_assignment_groups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignment_groups_group ON public.task_assignment_groups(group_id);

ALTER TABLE public.task_assignment_groups ENABLE ROW LEVEL SECURITY;

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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );