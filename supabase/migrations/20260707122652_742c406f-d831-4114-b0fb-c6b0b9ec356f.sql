
DROP POLICY IF EXISTS "Users insert own response if assigned" ON public.survey_responses;
CREATE POLICY "Users insert own response if assigned or unrestricted"
ON public.survey_responses FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published')
  AND (
    public.is_survey_assigned_to(auth.uid(), survey_id)
    OR public.can_manage_survey(auth.uid(), survey_id)
    OR NOT EXISTS (SELECT 1 FROM public.survey_assignments a WHERE a.survey_id = survey_responses.survey_id)
  )
);
