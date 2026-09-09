CREATE TABLE public.page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  page_key text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_permissions TO authenticated;
GRANT ALL ON public.page_permissions TO service_role;

ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_permissions_read" ON public.page_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "page_permissions_admin_write" ON public.page_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_page_permissions_updated BEFORE UPDATE ON public.page_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_permissions TO authenticated;
GRANT ALL ON public.user_page_permissions TO service_role;

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_page_permissions_read" ON public.user_page_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_page_permissions_admin_write" ON public.user_page_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_page_permissions_updated BEFORE UPDATE ON public.user_page_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();