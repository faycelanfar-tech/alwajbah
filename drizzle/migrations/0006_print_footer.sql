ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS footer_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS print_show_identity boolean NOT NULL DEFAULT false;