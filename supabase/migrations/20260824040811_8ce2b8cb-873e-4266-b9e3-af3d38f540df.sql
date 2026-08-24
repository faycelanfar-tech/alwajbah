DROP POLICY IF EXISTS "va read" ON storage.objects;
CREATE POLICY "va read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'violation-attachments');

DROP POLICY IF EXISTS "va insert" ON storage.objects;
CREATE POLICY "va insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'violation-attachments');

DROP POLICY IF EXISTS "va delete" ON storage.objects;
CREATE POLICY "va delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'violation-attachments' AND owner = auth.uid());