CREATE OR REPLACE FUNCTION public.supervises_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.teacher_classes tc WHERE tc.user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teacher_classes tc ON tc.class_id = s.class_id
        WHERE s.id = _student_id AND tc.user_id = _user_id
      );
$$;

REVOKE EXECUTE ON FUNCTION public.supervises_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supervises_student(uuid, uuid) TO authenticated;

CREATE POLICY "supervisors update actions"
ON public.violations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'supervisor'::app_role)
  AND public.supervises_student(auth.uid(), student_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'supervisor'::app_role)
  AND public.supervises_student(auth.uid(), student_id)
);