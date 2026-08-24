-- 1. attachment column
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS attachment_url text;

-- 2. remove duplicate points trigger
DROP TRIGGER IF EXISTS trg_violation_points ON public.violations;

-- 3. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own notifications" ON public.notifications;
CREATE POLICY "read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
CREATE POLICY "update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete own notifications" ON public.notifications;
CREATE POLICY "delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert notifications" ON public.notifications;
CREATE POLICY "insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, read, created_at DESC);

-- 4. auto notifications
CREATE OR REPLACE FUNCTION public.notify_violation_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student text;
  r record;
BEGIN
  SELECT full_name INTO v_student FROM public.students WHERE id = NEW.student_id;

  IF TG_OP = 'INSERT' THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','supervisor') LOOP
      INSERT INTO public.notifications(user_id, kind, title, body, link)
      VALUES (r.user_id, 'pending_action', 'مخالفة بانتظار إجراء',
              COALESCE(v_student,'طالب') || ' — تم تسجيل مخالفة جديدة', '/actions');
    END LOOP;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.action_taken IS DISTINCT FROM NEW.action_taken AND NEW.action_taken IS NOT NULL THEN
    IF NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link)
      VALUES (NEW.created_by, 'action_taken', 'تم اتخاذ إجراء',
              COALESCE(v_student,'طالب') || ' — ' || NEW.action_taken, '/violations');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_violation ON public.violations;
CREATE TRIGGER trg_notify_violation
AFTER INSERT OR UPDATE ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.notify_violation_events();