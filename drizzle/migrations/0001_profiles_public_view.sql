CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, username, full_name
  FROM public.profiles
  WHERE username <> 'admin';

GRANT SELECT ON public.profiles_public TO authenticated;