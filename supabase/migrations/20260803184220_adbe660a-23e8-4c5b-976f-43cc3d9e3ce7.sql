DROP POLICY "Users insert own response if assigned or unrestricted" ON public.survey_responses;
CREATE POLICY "Users insert own response to published surveys"
ON public.survey_responses FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_responses.survey_id AND (s.status = 'published'::survey_status OR public.can_manage_survey(auth.uid(), s.id)))
);