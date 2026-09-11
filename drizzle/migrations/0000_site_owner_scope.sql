-- معرّف حساب مسؤول الموقع
CREATE OR REPLACE FUNCTION public.site_owner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE username = 'admin' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_site_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND username = 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.site_owner_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_site_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_owner_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_site_owner() TO authenticated, service_role;

-- هوية الموقع: التعديل لمسؤول الموقع وحده
DROP POLICY IF EXISTS "admins update settings" ON public.app_settings;
CREATE POLICY "site owner updates settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_site_owner()) WITH CHECK (public.is_site_owner());

-- صلاحيات الصفحات: الكتابة لمسؤول الموقع وحده
DROP POLICY IF EXISTS page_permissions_admin_write ON public.page_permissions;
CREATE POLICY page_permissions_owner_write ON public.page_permissions
  FOR ALL TO authenticated
  USING (public.is_site_owner()) WITH CHECK (public.is_site_owner());

DROP POLICY IF EXISTS user_page_permissions_admin_write ON public.user_page_permissions;
CREATE POLICY user_page_permissions_owner_write ON public.user_page_permissions
  FOR ALL TO authenticated
  USING (public.is_site_owner()) WITH CHECK (public.is_site_owner());

-- إخفاء حساب مسؤول الموقع عن باقي الحسابات
DROP POLICY IF EXISTS "view own profile" ON public.profiles;
CREATE POLICY "view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR (has_role(auth.uid(), 'admin'::app_role) AND (public.is_site_owner() OR username <> 'admin'))
  );

DROP POLICY IF EXISTS "admins update profiles" ON public.profiles;
CREATE POLICY "admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (public.is_site_owner() OR id <> public.site_owner_id())
  );

-- إخفاء عمليات مسؤول الموقع من سجل التتبع عن باقي الحسابات
DROP POLICY IF EXISTS "Admins can read activity log" ON public.activity_log;
CREATE POLICY "Admins can read activity log" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (public.is_site_owner() OR actor_id IS DISTINCT FROM public.site_owner_id())
  );