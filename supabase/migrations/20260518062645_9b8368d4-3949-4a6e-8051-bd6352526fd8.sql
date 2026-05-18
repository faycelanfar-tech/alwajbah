
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  student_number TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_students_class ON public.students(class_id);

-- Violation types
CREATE TABLE public.violation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'متوسطة',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.violation_types ENABLE ROW LEVEL SECURITY;

-- Violations
CREATE TABLE public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type_id UUID REFERENCES public.violation_types(id) ON DELETE SET NULL,
  description TEXT,
  action_taken TEXT,
  violation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_violations_student ON public.violations(student_id);
CREATE INDEX idx_violations_date ON public.violations(violation_date);

-- App settings (singleton)
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT 'مدرسة الوجبة الابتدائية',
  logo_url TEXT,
  footer_text TEXT DEFAULT 'تطوير: فيصل أحمد عنفار',
  primary_color TEXT DEFAULT '#1d4ed8',
  subtitle TEXT DEFAULT 'نظام إدارة المخالفات السلوكية',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Trigger: new user -> profile + first user is admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
  v_is_first BOOLEAN;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);

  INSERT INTO public.profiles (id, username, full_name)
  VALUES (NEW.id, v_username, v_full_name)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO v_is_first;

  IF v_is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- default new accounts to teacher; admin can change later
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'teacher'));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for settings
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_app_settings_updated
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== RLS POLICIES =====

-- profiles: user can view own; admins view all; admins update all; user can update own basic info
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles: user view own; admins manage
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- classes: all authenticated read; admins write
CREATE POLICY "authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage classes" ON public.classes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- students: all authenticated read; admins write
CREATE POLICY "authenticated read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- violation_types: all read; admins write
CREATE POLICY "authenticated read violation_types" ON public.violation_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage violation_types" ON public.violation_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- violations: all authenticated read; teachers & admins create; creator or admin update/delete
CREATE POLICY "authenticated read violations" ON public.violations FOR SELECT TO authenticated USING (true);
CREATE POLICY "create violations" ON public.violations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "update own or admin" ON public.violations FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete own or admin" ON public.violations FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- app_settings: all read (also public for login page); admins update
CREATE POLICY "public read settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default violation types
INSERT INTO public.violation_types (name, severity) VALUES
  ('التأخر عن الطابور', 'بسيطة'),
  ('عدم إحضار الكتاب', 'بسيطة'),
  ('عدم أداء الواجب', 'بسيطة'),
  ('الفوضى داخل الفصل', 'متوسطة'),
  ('عدم الالتزام بالزي', 'متوسطة'),
  ('التشويش على المعلم', 'متوسطة'),
  ('الإضرار بممتلكات المدرسة', 'كبيرة'),
  ('الاعتداء على الزملاء', 'كبيرة'),
  ('استخدام ألفاظ غير لائقة', 'كبيرة');

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('app-assets', 'app-assets', true);

CREATE POLICY "public read app-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'app-assets');
CREATE POLICY "admins upload app-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update app-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete app-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
