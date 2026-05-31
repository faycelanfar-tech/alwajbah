
-- Add 'supervisor' role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- Update defaults
ALTER TABLE public.student_points ALTER COLUMN points SET DEFAULT 50;
ALTER TABLE public.class_weekly_points ALTER COLUMN points SET DEFAULT 300;

-- Update violation-points function with new starting values and severity deltas
CREATE OR REPLACE FUNCTION public.apply_violation_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      WHEN 'الثانية' THEN -2
      WHEN 'الثالثة' THEN -5
      WHEN 'الرابعة' THEN -10
      ELSE -1 END;
  END IF;
  SELECT class_id INTO v_class FROM public.students WHERE id = NEW.student_id;

  INSERT INTO public.student_points(student_id, points) VALUES (NEW.student_id, 50 + v_delta)
  ON CONFLICT (student_id) DO UPDATE SET points = public.student_points.points + v_delta, updated_at = now();

  INSERT INTO public.point_transactions(student_id, class_id, delta, reason, kind, created_by)
  VALUES (NEW.student_id, v_class, v_delta, 'مخالفة درجة ' || COALESCE(v_sev,'غير محدد'), 'violation', NEW.created_by);

  IF v_class IS NOT NULL THEN
    INSERT INTO public.class_weekly_points(class_id, week_start, points)
    VALUES (v_class, v_week, 300 + v_delta)
    ON CONFLICT (class_id, week_start) DO UPDATE SET points = public.class_weekly_points.points + v_delta, updated_at = now();
  END IF;

  RETURN NEW;
END $function$;

-- Ensure trigger exists on violations
DROP TRIGGER IF EXISTS trg_apply_violation_points ON public.violations;
CREATE TRIGGER trg_apply_violation_points
AFTER INSERT ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.apply_violation_points();

-- Logos storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read logos" ON storage.objects;
CREATE POLICY "public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "admin write logos" ON storage.objects;
CREATE POLICY "admin write logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update logos" ON storage.objects;
CREATE POLICY "admin update logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete logos" ON storage.objects;
CREATE POLICY "admin delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
