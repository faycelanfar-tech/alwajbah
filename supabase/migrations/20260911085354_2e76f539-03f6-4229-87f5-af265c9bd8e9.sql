
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  summary text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read activity log"
ON public.activity_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_role text;
  v_action text;
  v_row jsonb;
  v_id uuid;
BEGIN
  SELECT COALESCE(full_name, username) INTO v_name FROM public.profiles WHERE id = v_user;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_user LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    v_action := 'deleted'; v_row := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated'; v_row := to_jsonb(NEW);
  ELSE
    v_action := 'created'; v_row := to_jsonb(NEW);
  END IF;

  BEGIN
    v_id := (v_row->>'id')::uuid;
  EXCEPTION WHEN others THEN v_id := NULL;
  END;

  INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, entity, entity_id, summary, details)
  VALUES (v_user, v_name, v_role, v_action, TG_TABLE_NAME, v_id,
          COALESCE(v_row->>'full_name', v_row->>'name', v_row->>'label', v_row->>'text', v_row->>'page_key', v_row->>'school_name'),
          v_row);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_activity_students AFTER INSERT OR UPDATE OR DELETE ON public.students FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_classes AFTER INSERT OR UPDATE OR DELETE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_violations AFTER INSERT OR UPDATE OR DELETE ON public.violations FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_positive AFTER INSERT OR UPDATE OR DELETE ON public.positive_behaviors FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_academic AFTER INSERT OR UPDATE OR DELETE ON public.academic_reports FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_page_permissions AFTER INSERT OR UPDATE OR DELETE ON public.page_permissions FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_user_page_permissions AFTER INSERT OR UPDATE OR DELETE ON public.user_page_permissions FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_app_settings AFTER INSERT OR UPDATE OR DELETE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_action_templates AFTER INSERT OR UPDATE OR DELETE ON public.action_templates FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_subjects AFTER INSERT OR UPDATE OR DELETE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Protect the site owner account (username = 'admin')
CREATE OR REPLACE FUNCTION public.protect_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.username = 'admin' THEN
      RAISE EXCEPTION 'هذا الحساب محمي ولا يمكن تعديله';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.username = 'admin' AND (NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.username IS DISTINCT FROM OLD.username) THEN
    RAISE EXCEPTION 'هذا الحساب محمي ولا يمكن تعديله';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_admin_profile BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_profile();

CREATE OR REPLACE FUNCTION public.protect_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uname text;
BEGIN
  SELECT username INTO v_uname FROM public.profiles WHERE id = COALESCE(OLD.user_id, NEW.user_id);
  IF v_uname = 'admin' THEN
    RAISE EXCEPTION 'هذا الحساب محمي ولا يمكن تعديله';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_admin_role BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_role();

CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_role text;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  SELECT COALESCE(full_name, username) INTO v_name FROM public.profiles WHERE id = v_user;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_user LIMIT 1;
  UPDATE public.profiles SET last_login_at = now() WHERE id = v_user;
  INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, entity, entity_id, summary)
  VALUES (v_user, v_name, v_role, 'login', 'auth', v_user, 'تسجيل دخول');
END $$;

REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;
