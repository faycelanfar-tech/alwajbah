
DROP POLICY IF EXISTS "auth read app-assets" ON storage.objects;
DROP POLICY IF EXISTS "anon read logo only" ON storage.objects;
CREATE POLICY "read logo only" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'app-assets' AND name LIKE 'logo%');
