
-- AUDIT LOG
CREATE TABLE public.violation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id uuid NOT NULL REFERENCES public.violations(id) ON DELETE CASCADE,
  action text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.violation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read history" ON public.violation_history FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_vh_violation ON public.violation_history(violation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_violation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_action text;
BEGIN
  SELECT COALESCE(full_name, username) INTO v_name FROM public.profiles WHERE id = v_user;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.violation_history(violation_id, action, changed_by, changed_by_name, new_data)
    VALUES (NEW.id, 'created', v_user, v_name, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := CASE
      WHEN OLD.action_taken IS DISTINCT FROM NEW.action_taken THEN
        CASE WHEN NEW.action_taken IS NULL THEN 'action_cleared' ELSE 'action_set' END
      ELSE 'updated' END;
    INSERT INTO public.violation_history(violation_id, action, changed_by, changed_by_name, old_data, new_data)
    VALUES (NEW.id, v_action, v_user, v_name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_violations_log
AFTER INSERT OR UPDATE ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.log_violation_change();

-- POINTS SYSTEM
CREATE TABLE public.student_points (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sp" ON public.student_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage sp" ON public.student_points FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.class_weekly_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  points integer NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, week_start)
);
ALTER TABLE public.class_weekly_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cwp" ON public.class_weekly_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage cwp" ON public.class_weekly_points FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  kind text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pt" ON public.point_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert pt" ON public.point_transactions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin delete pt" ON public.point_transactions FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE INDEX idx_pt_student ON public.point_transactions(student_id, created_at DESC);
CREATE INDEX idx_pt_class ON public.point_transactions(class_id, created_at DESC);

-- Auto-deduct on violation insert
CREATE OR REPLACE FUNCTION public.apply_violation_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sev text;
  v_delta int := -1;
  v_class uuid;
  v_week date := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  IF NEW.type_id IS NOT NULL THEN
    SELECT severity INTO v_sev FROM public.violation_types WHERE id = NEW.type_id;
    v_delta := CASE v_sev
      WHEN 'الأولى' THEN -1
      WHEN 'الثانية' THEN -3
      WHEN 'الثالثة' THEN -5
      WHEN 'الرابعة' THEN -10
      ELSE -1 END;
  END IF;
  SELECT class_id INTO v_class FROM public.students WHERE id = NEW.student_id;

  INSERT INTO public.student_points(student_id, points) VALUES (NEW.student_id, 100 + v_delta)
  ON CONFLICT (student_id) DO UPDATE SET points = public.student_points.points + v_delta, updated_at = now();

  INSERT INTO public.point_transactions(student_id, class_id, delta, reason, kind, created_by)
  VALUES (NEW.student_id, v_class, v_delta, 'مخالفة درجة ' || COALESCE(v_sev,'غير محدد'), 'violation', NEW.created_by);

  IF v_class IS NOT NULL THEN
    INSERT INTO public.class_weekly_points(class_id, week_start, points)
    VALUES (v_class, v_week, 500 + v_delta)
    ON CONFLICT (class_id, week_start) DO UPDATE SET points = public.class_weekly_points.points + v_delta, updated_at = now();
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_violation_points
AFTER INSERT ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.apply_violation_points();
