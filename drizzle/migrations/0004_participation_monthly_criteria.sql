ALTER TABLE public.participation_entries ADD COLUMN IF NOT EXISTS criterion text;
ALTER TABLE public.participation_cycles ADD COLUMN IF NOT EXISTS month date;
UPDATE public.participation_cycles SET month = date_trunc('month', start_date)::date WHERE month IS NULL;
CREATE INDEX IF NOT EXISTS participation_cycles_month_idx ON public.participation_cycles (teacher_id, class_id, month);