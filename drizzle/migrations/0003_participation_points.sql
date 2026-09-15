CREATE TABLE public.participation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  label text,
  period_type text NOT NULL DEFAULT 'weekly',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  base_score integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX participation_cycles_active_uniq
  ON public.participation_cycles (teacher_id, class_id) WHERE is_active;

CREATE TABLE public.participation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.participation_cycles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  kind text NOT NULL DEFAULT 'bonus',
  reason text,
  note text,
  period smallint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX participation_entries_cycle_idx ON public.participation_entries (cycle_id, student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participation_cycles TO authenticated;
GRANT ALL ON public.participation_cycles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participation_entries TO authenticated;
GRANT ALL ON public.participation_entries TO service_role;

ALTER TABLE public.participation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycles select own or admin" ON public.participation_cycles
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_site_owner());
CREATE POLICY "cycles insert own" ON public.participation_cycles
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "cycles update own or admin" ON public.participation_cycles
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_site_owner());
CREATE POLICY "cycles delete own or admin" ON public.participation_cycles
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_site_owner());

CREATE POLICY "entries select own or admin" ON public.participation_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.participation_cycles c WHERE c.id = cycle_id
      AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_site_owner())));
CREATE POLICY "entries insert own" ON public.participation_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.participation_cycles c WHERE c.id = cycle_id AND c.teacher_id = auth.uid()));
CREATE POLICY "entries delete own or admin" ON public.participation_entries
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.participation_cycles c WHERE c.id = cycle_id
      AND (c.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_site_owner())));