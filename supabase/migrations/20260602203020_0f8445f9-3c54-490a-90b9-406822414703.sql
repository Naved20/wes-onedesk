
-- 1. Preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  announcements boolean NOT NULL DEFAULT true,
  leaves boolean NOT NULL DEFAULT true,
  attendance boolean NOT NULL DEFAULT true,
  tasks boolean NOT NULL DEFAULT true,
  salary boolean NOT NULL DEFAULT true,
  documents boolean NOT NULL DEFAULT true,
  support boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
ON public.notification_preferences FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all notification preferences"
ON public.notification_preferences FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- auto-create defaults on signup
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_prefs
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- backfill for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. Helper: send a notification respecting preferences
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,          -- announcement|leave|attendance|task|salary|document|support
  p_title text,
  p_message text,
  p_related_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  allow boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.notification_preferences (user_id) VALUES (p_user_id)
      ON CONFLICT (user_id) DO NOTHING;
    allow := true;
  ELSE
    IF NOT prefs.enabled THEN RETURN; END IF;
    allow := CASE p_type
      WHEN 'announcement' THEN prefs.announcements
      WHEN 'leave'        THEN prefs.leaves
      WHEN 'attendance'   THEN prefs.attendance
      WHEN 'task'         THEN prefs.tasks
      WHEN 'salary'       THEN prefs.salary
      WHEN 'document'     THEN prefs.documents
      WHEN 'support'      THEN prefs.support
      ELSE true END;
  END IF;
  IF NOT allow THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_related_id);
END $$;

-- 3. Announcement → notify all relevant users
CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record;
BEGIN
  IF COALESCE(NEW.is_active, true) = false THEN RETURN NEW; END IF;
  FOR u IN
    SELECT ep.user_id FROM public.employee_profiles ep
    WHERE COALESCE(ep.is_active, true) = true
      AND ( NEW.is_org_wide = true OR ep.institution_assignment = NEW.institution )
  LOOP
    PERFORM public.notify_user(u.user_id, 'announcement',
      'New Announcement: ' || NEW.title,
      LEFT(COALESCE(NEW.content, ''), 200), NEW.id);
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();

-- 4. Leaves: apply → notify approvers; status change → notify user
CREATE OR REPLACE FUNCTION public.notify_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ep_name text;
  approver record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT first_name || ' ' || last_name INTO ep_name
      FROM public.employee_profiles WHERE user_id = NEW.user_id;
    FOR approver IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','manager')
    LOOP
      PERFORM public.notify_user(approver.user_id, 'leave',
        'New leave request',
        COALESCE(ep_name,'An employee') || ' applied for ' || NEW.leave_type::text || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ')',
        NEW.id);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.notify_user(NEW.user_id, 'leave',
      'Leave ' || NEW.status::text,
      'Your ' || NEW.leave_type::text || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') has been ' || NEW.status::text || COALESCE('. Reason: ' || NEW.rejection_reason, ''),
      NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_leave ON public.leaves;
CREATE TRIGGER trg_notify_leave AFTER INSERT OR UPDATE ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.notify_leave();

-- 5. Attendance approval/rejection → notify user
CREATE OR REPLACE FUNCTION public.notify_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status::text <> OLD.status::text
     AND NEW.status::text IN ('approved','rejected') THEN
    PERFORM public.notify_user(NEW.user_id, 'attendance',
      'Attendance ' || NEW.status::text,
      'Your attendance for ' || NEW.date || ' has been ' || NEW.status::text || COALESCE('. Reason: ' || NEW.rejection_reason, ''),
      NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_attendance ON public.attendance;
CREATE TRIGGER trg_notify_attendance AFTER UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.notify_attendance();

-- 6. Task assignment → notify user
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_title text;
BEGIN
  SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
  PERFORM public.notify_user(NEW.user_id, 'task',
    'New task assigned',
    'You have been assigned: ' || COALESCE(t_title, 'a task'),
    NEW.task_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.task_assignments;
CREATE TRIGGER trg_notify_task_assignment AFTER INSERT ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- 7. Peer reviewer assigned → notify reviewer
CREATE OR REPLACE FUNCTION public.notify_peer_reviewer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_title text;
BEGIN
  SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
  PERFORM public.notify_user(NEW.reviewer_id, 'task',
    'Peer review requested',
    'You have been asked to review: ' || COALESCE(t_title, 'a task'),
    NEW.task_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_peer_reviewer ON public.individual_peer_reviewers;
CREATE TRIGGER trg_notify_peer_reviewer AFTER INSERT ON public.individual_peer_reviewers
FOR EACH ROW EXECUTE FUNCTION public.notify_peer_reviewer();

-- 8. Payroll / Salary → notify employee
CREATE OR REPLACE FUNCTION public.notify_payroll()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.user_id, 'salary',
      'Payslip generated',
      'Your payslip for ' || to_char(NEW.payroll_month, 'Mon YYYY') || ' is now available. Net payable: ₹' || NEW.net_payable,
      NEW.id);
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'')
        AND NEW.status = 'paid' THEN
    PERFORM public.notify_user(NEW.user_id, 'salary',
      'Salary paid',
      'Your salary for ' || to_char(NEW.payroll_month, 'Mon YYYY') || ' has been paid. Amount: ₹' || NEW.net_payable,
      NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_payroll ON public.payroll_register;
CREATE TRIGGER trg_notify_payroll AFTER INSERT OR UPDATE ON public.payroll_register
FOR EACH ROW EXECUTE FUNCTION public.notify_payroll();

-- 9. Document verified → notify owner
CREATE OR REPLACE FUNCTION public.notify_document_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.verified,false) = true AND COALESCE(OLD.verified,false) = false THEN
    PERFORM public.notify_user(NEW.user_id, 'document',
      'Document verified',
      'Your document "' || COALESCE(NEW.document_name, NEW.title) || '" has been verified.',
      NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_document ON public.documents;
CREATE TRIGGER trg_notify_document AFTER UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_document_verified();

-- 10. Support reply → notify other party
CREATE OR REPLACE FUNCTION public.notify_support_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.support_requests%ROWTYPE;
  approver record;
BEGIN
  IF COALESCE(NEW.is_internal, false) = true THEN RETURN NEW; END IF;
  SELECT * INTO req FROM public.support_requests WHERE id = NEW.request_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.user_id = req.user_id THEN
    -- owner replied → notify admins
    FOR approver IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.notify_user(approver.user_id, 'support',
        'Reply on support request',
        'Reply on: ' || COALESCE(req.subject, 'support request'),
        req.id);
    END LOOP;
  ELSE
    -- staff replied → notify owner
    PERFORM public.notify_user(req.user_id, 'support',
      'New reply to your request',
      'Reply on: ' || COALESCE(req.subject, 'support request'),
      req.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_support_reply ON public.support_request_replies;
CREATE TRIGGER trg_notify_support_reply AFTER INSERT ON public.support_request_replies
FOR EACH ROW EXECUTE FUNCTION public.notify_support_reply();

-- 11. Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
