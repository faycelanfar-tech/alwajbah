CREATE TABLE public.positive_behavior_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.positive_behavior_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.positive_behavior_types TO authenticated;
GRANT ALL ON public.positive_behavior_types TO service_role;
ALTER TABLE public.positive_behavior_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pbt" ON public.positive_behavior_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage pbt" ON public.positive_behavior_types FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.positive_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type_id uuid REFERENCES public.positive_behavior_types(id) ON DELETE SET NULL,
  note text,
  period smallint,
  points integer NOT NULL DEFAULT 1,
  behavior_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE, UPDATE ON public.positive_behaviors TO authenticated;
GRANT ALL ON public.positive_behaviors TO service_role;
ALTER TABLE public.positive_behaviors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pb" ON public.positive_behaviors FOR SELECT TO authenticated USING (true);
CREATE POLICY "create pb" ON public.positive_behaviors FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "delete own pb or admin" ON public.positive_behaviors FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "update own pb or admin" ON public.positive_behaviors FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

CREATE INDEX idx_pb_student ON public.positive_behaviors(student_id);
CREATE INDEX idx_pb_date ON public.positive_behaviors(behavior_date);

INSERT INTO public.positive_behavior_types (name, points) VALUES
  ('تعاون مع الزملاء', 2),
  ('مشاركة متميزة', 2),
  ('نظافة والتزام بالمظهر', 1),
  ('التزام بالواجبات المنزلية', 2),
  ('مساعدة زميل', 3),
  ('تفوق دراسي', 5);

CREATE OR REPLACE FUNCTION public.apply_positive_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_points int := COALESCE(NEW.points, 1);
  v_class uuid;
  v_week date := date_trunc('week', CURRENT_DATE)::date;
  v_student text;
  r record;
BEGIN
  SELECT class_id, full_name INTO v_class, v_student FROM public.students WHERE id = NEW.student_id;

  INSERT INTO public.student_points(student_id, points) VALUES (NEW.student_id, 50 + v_points)
  ON CONFLICT (student_id) DO UPDATE SET points = public.student_points.points + v_points, updated_at = now();

  INSERT INTO public.point_transactions(student_id, class_id, delta, reason, kind, created_by)
  VALUES (NEW.student_id, v_class, v_points, 'سلوك إيجابي', 'positive', NEW.created_by);

  IF v_class IS NOT NULL THEN
    INSERT INTO public.class_weekly_points(class_id, week_start, points)
    VALUES (v_class, v_week, 300 + v_points)
    ON CONFLICT (class_id, week_start) DO UPDATE SET points = public.class_weekly_points.points + v_points, updated_at = now();
  END IF;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','supervisor') LOOP
    INSERT INTO public.notifications(user_id, kind, title, body, link)
    VALUES (r.user_id, 'positive', 'سلوك إيجابي جديد',
            COALESCE(v_student,'طالب') || ' — تم رصد سلوك إيجابي (+' || v_points || ')', '/positive');
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_positive_points
AFTER INSERT ON public.positive_behaviors
FOR EACH ROW EXECUTE FUNCTION public.apply_positive_points();

CREATE OR REPLACE FUNCTION public.log_violation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.violation_history(violation_id, action, changed_by, changed_by_name, old_data)
    VALUES (OLD.id, 'deleted', v_user, v_name, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

ALTER TABLE public.violation_history DROP CONSTRAINT IF EXISTS violation_history_violation_id_fkey;

CREATE TRIGGER trg_violations_delete_log
BEFORE DELETE ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.log_violation_change();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;