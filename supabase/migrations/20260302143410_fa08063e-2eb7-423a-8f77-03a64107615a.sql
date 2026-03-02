
-- Allow admins and leaders to delete evaluation_attempts (for re-evaluation)
CREATE POLICY "Admins and leaders can delete attempts"
ON public.evaluation_attempts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'leader'::app_role));

-- Allow admins and leaders to delete evaluation_answers (for re-evaluation)
CREATE POLICY "Admins and leaders can delete answers"
ON public.evaluation_answers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'leader'::app_role));
