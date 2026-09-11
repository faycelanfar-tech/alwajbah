ALTER TABLE public.academic_reports ADD COLUMN IF NOT EXISTS score numeric;

CREATE TABLE public.behavior_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  min_violations integer NOT NULL DEFAULT 0,
  max_violations integer,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_levels TO authenticated;
GRANT ALL ON public.behavior_levels TO service_role;

ALTER TABLE public.behavior_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "behavior_levels_read" ON public.behavior_levels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "behavior_levels_admin_write" ON public.behavior_levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_behavior_levels_updated BEFORE UPDATE ON public.behavior_levels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.behavior_levels (label, color, min_violations, max_violations, sort_order) VALUES
  ('ممتاز', '#10b981', 0, 0, 1),
  ('جيد', '#2563eb', 1, 3, 2),
  ('متوسط', '#f59e0b', 4, 5, 3),
  ('ضعيف', '#ef4444', 6, NULL, 4);