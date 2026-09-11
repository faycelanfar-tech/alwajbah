
REVOKE ALL ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_admin_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;
