DROP POLICY IF EXISTS "admins manage students" ON public.students;

CREATE POLICY "admins and supervisors manage students"
ON public.students
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));