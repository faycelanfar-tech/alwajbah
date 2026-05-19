-- 1) period 1-7 on violations
ALTER TABLE public.violations ADD COLUMN IF NOT EXISTS period smallint;
ALTER TABLE public.violations DROP CONSTRAINT IF EXISTS violations_period_check;
ALTER TABLE public.violations ADD CONSTRAINT violations_period_check CHECK (period IS NULL OR (period BETWEEN 1 AND 7));

-- 2) Blank default school name + clear seeded value
ALTER TABLE public.app_settings ALTER COLUMN school_name SET DEFAULT '';
ALTER TABLE public.app_settings ALTER COLUMN subtitle SET DEFAULT '';
UPDATE public.app_settings SET school_name = '' WHERE id = 1 AND school_name = 'مدرسة الوجبة الابتدائية';

-- 3) Normalize ALL existing severity values BEFORE adding the check
UPDATE public.violation_types
SET severity = CASE
  WHEN severity IN ('الأولى','الثانية','الثالثة','الرابعة') THEN severity
  WHEN severity ILIKE '%خفيف%' OR severity ILIKE '%بسيط%' THEN 'الأولى'
  WHEN severity ILIKE '%متوسط%' THEN 'الثانية'
  WHEN severity ILIKE '%شديد%' OR severity ILIKE '%عالي%' THEN 'الثالثة'
  WHEN severity ILIKE '%خطير%' OR severity ILIKE '%جسيم%' THEN 'الرابعة'
  ELSE 'الأولى'
END;

ALTER TABLE public.violation_types ALTER COLUMN severity SET DEFAULT 'الأولى';
ALTER TABLE public.violation_types DROP CONSTRAINT IF EXISTS violation_types_severity_check;
ALTER TABLE public.violation_types ADD CONSTRAINT violation_types_severity_check
  CHECK (severity IN ('الأولى','الثانية','الثالثة','الرابعة'));

-- 4) Seed default classes if missing
INSERT INTO public.classes (name, grade)
SELECT n, 'الخامس' FROM (VALUES ('خامس 1'),('خامس 2'),('خامس 3'),('خامس 4'),('خامس 5'),('خامس 6'),('خامس 7')) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM public.classes WHERE name = t.n);

INSERT INTO public.classes (name, grade)
SELECT n, 'السادس' FROM (VALUES ('سادس 1'),('سادس 2'),('سادس 3'),('سادس 4'),('سادس 5'),('سادس 6')) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM public.classes WHERE name = t.n);
