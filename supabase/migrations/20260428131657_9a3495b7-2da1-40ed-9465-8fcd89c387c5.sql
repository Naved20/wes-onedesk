
CREATE TABLE public.task_peer_reviewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_peer_reviewers_task ON public.task_peer_reviewers(task_id);
CREATE INDEX idx_task_peer_reviewers_user ON public.task_peer_reviewers(user_id);

ALTER TABLE public.task_peer_reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and managers manage peer reviewers"
ON public.task_peer_reviewers
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager')))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager')));

CREATE POLICY "Authenticated can view peer reviewers"
ON public.task_peer_reviewers
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.is_peer_reviewer(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_peer_reviewers
    WHERE task_id = _task_id AND user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Admin and managers can create remarks" ON public.task_remarks;
CREATE POLICY "Admin managers and peer reviewers create remarks"
ON public.task_remarks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager'))
  OR EXISTS (
    SELECT 1 FROM task_responses tr
    WHERE tr.id = task_remarks.response_id
      AND tr.user_id <> auth.uid()
      AND public.is_peer_reviewer(auth.uid(), tr.task_id)
  )
);

DROP POLICY IF EXISTS "Admin and managers can update remarks" ON public.task_remarks;
CREATE POLICY "Admin managers and peer reviewers update own remarks"
ON public.task_remarks
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager'))
  OR remarked_by = auth.uid()
);

DROP POLICY IF EXISTS "Admin and managers can delete remarks" ON public.task_remarks;
CREATE POLICY "Admin managers and peer reviewers delete own remarks"
ON public.task_remarks
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager'))
  OR remarked_by = auth.uid()
);
