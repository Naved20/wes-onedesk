
-- Peer Reviewer Groups
CREATE TABLE public.peer_reviewer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.peer_reviewer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view groups"
ON public.peer_reviewer_groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and managers manage groups"
ON public.peer_reviewer_groups FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
);

CREATE TRIGGER trg_peer_reviewer_groups_updated
BEFORE UPDATE ON public.peer_reviewer_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Group Members
CREATE TABLE public.peer_reviewer_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.peer_reviewer_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.peer_reviewer_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view group members"
ON public.peer_reviewer_group_members FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and managers manage group members"
ON public.peer_reviewer_group_members FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
);

CREATE INDEX idx_prg_members_group ON public.peer_reviewer_group_members(group_id);
CREATE INDEX idx_prg_members_user ON public.peer_reviewer_group_members(user_id);

-- Track which groups were assigned to which task (for UI display only — actual reviewers are snapshotted into task_peer_reviewers)
CREATE TABLE public.task_peer_reviewer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.peer_reviewer_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, group_id)
);

ALTER TABLE public.task_peer_reviewer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task groups"
ON public.task_peer_reviewer_groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and managers manage task groups"
ON public.task_peer_reviewer_groups FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin','manager'))
);

CREATE INDEX idx_tprg_task ON public.task_peer_reviewer_groups(task_id);
