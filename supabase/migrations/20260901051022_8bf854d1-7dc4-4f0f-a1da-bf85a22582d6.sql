ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'academic_deputy';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_deputy';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student_affairs';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'social_specialist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'psych_specialist';

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.academic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  month date NOT NULL,
  level text NOT NULL CHECK (level IN ('ضعيف','متوسط','جيد','ممتاز')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_reports TO authenticated;
GRANT ALL ON public.academic_reports TO service_role;
ALTER TABLE public.academic_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read academic" ON public.academic_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "teacher admin insert academic" ON public.academic_reports FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "teacher admin update academic" ON public.academic_reports FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "teacher admin delete academic" ON public.academic_reports FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_academic_updated BEFORE UPDATE ON public.academic_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_academic_month ON public.academic_reports(month);
CREATE INDEX IF NOT EXISTS idx_academic_student ON public.academic_reports(student_id);

INSERT INTO public.subjects (name, sort_order) VALUES
  ('القرآن الكريم', 1),
  ('التربية الإسلامية', 2),
  ('اللغة العربية', 3),
  ('الرياضيات', 4),
  ('العلوم', 5),
  ('اللغة الإنجليزية', 6),
  ('الاجتماعيات', 7),
  ('التربية البدنية', 8),
  ('التربية الفنية', 9),
  ('الحاسب الآلي', 10)
ON CONFLICT (name) DO NOTHING;