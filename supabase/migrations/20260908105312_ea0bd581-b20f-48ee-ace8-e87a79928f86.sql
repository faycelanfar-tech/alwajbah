ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Users can update own profile flags" ON public.profiles;
CREATE POLICY "Users can update own profile flags" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);