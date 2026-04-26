
-- Face descriptors table (one per user)
CREATE TABLE public.face_descriptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  descriptor JSONB NOT NULL,
  photo_url TEXT,
  enrolled_by UUID,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all face descriptors"
ON public.face_descriptors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can read active descriptors"
ON public.face_descriptors FOR SELECT TO authenticated
USING (is_active = true);

CREATE TRIGGER trg_face_descriptors_updated
BEFORE UPDATE ON public.face_descriptors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Face check-in history
CREATE TABLE public.face_checkin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  matched BOOLEAN NOT NULL DEFAULT false,
  match_distance NUMERIC,
  attendance_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.face_checkin_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage face history"
ON public.face_checkin_history FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can insert face history"
ON public.face_checkin_history FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone authenticated can view face history"
ON public.face_checkin_history FOR SELECT TO authenticated
USING (true);

-- Storage bucket for enrollment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-enrollments', 'face-enrollments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read face enrollments"
ON storage.objects FOR SELECT
USING (bucket_id = 'face-enrollments');

CREATE POLICY "Admins write face enrollments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'face-enrollments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update face enrollments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'face-enrollments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete face enrollments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'face-enrollments' AND public.has_role(auth.uid(), 'admin'));
