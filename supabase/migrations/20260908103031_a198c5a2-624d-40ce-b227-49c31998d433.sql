CREATE TABLE public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT ALL ON public.academic_terms TO service_role;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read terms" ON public.academic_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage terms" ON public.academic_terms FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_terms_updated BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.grading_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  min_score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 100,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_levels TO authenticated;
GRANT ALL ON public.grading_levels TO service_role;
ALTER TABLE public.grading_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read grading" ON public.grading_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage grading" ON public.grading_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_grading_updated BEFORE UPDATE ON public.grading_levels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.grading_levels (label, color, min_score, max_score, sort_order) VALUES
  ('ممتاز', '#10b981', 90, 100, 1),
  ('جيد', '#2563eb', 75, 89, 2),
  ('متوسط', '#f59e0b', 50, 74, 3),
  ('ضعيف', '#ef4444', 0, 49, 4);

INSERT INTO public.academic_terms (name, start_date, end_date, is_current) VALUES
  ('الفصل الدراسي الأول', '2026-09-01', '2027-01-15', true),
  ('الفصل الدراسي الثاني', '2027-01-25', '2027-06-15', false);