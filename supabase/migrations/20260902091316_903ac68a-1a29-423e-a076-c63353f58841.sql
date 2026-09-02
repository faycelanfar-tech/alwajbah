CREATE TABLE public.action_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_templates TO authenticated;
GRANT ALL ON public.action_templates TO service_role;
ALTER TABLE public.action_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read action templates" ON public.action_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert action templates" ON public.action_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "staff update action templates" ON public.action_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "staff delete action templates" ON public.action_templates FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));
CREATE TRIGGER trg_action_templates_updated BEFORE UPDATE ON public.action_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT ALL ON public.teacher_subjects TO service_role;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read teacher subjects" ON public.teacher_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage teacher subjects" ON public.teacher_subjects FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_classes TO authenticated;
GRANT ALL ON public.teacher_classes TO service_role;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read teacher classes" ON public.teacher_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage teacher classes" ON public.teacher_classes FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.action_templates (text)
SELECT unnest(ARRAY['تنبيه شفهي','تعهد الطالب','إحالة للمرشد الطلابي','إحالة للإدارة','حسم من درجات السلوك','فصل','تغيير بيئة صفية','تغيير بيئة مدرسية'])
ON CONFLICT (text) DO NOTHING;