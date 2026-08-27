REVOKE ALL ON FUNCTION public.apply_positive_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_violation_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_violation_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_violation_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;