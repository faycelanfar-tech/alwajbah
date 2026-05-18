
-- Fix search_path on remaining function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Restrict storage listing: only authenticated users can list, and only specific files
DROP POLICY IF EXISTS "public read app-assets" ON storage.objects;
CREATE POLICY "auth read app-assets" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'app-assets');
-- Anonymous users can still access logo via public URL (CDN) without listing
CREATE POLICY "anon read logo only" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'app-assets' AND name LIKE 'logo%');
