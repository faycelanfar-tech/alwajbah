ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from auth.users where email is real (not @alwajbah.local)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND u.email NOT LIKE '%@alwajbah.local'
  AND p.email IS NULL;