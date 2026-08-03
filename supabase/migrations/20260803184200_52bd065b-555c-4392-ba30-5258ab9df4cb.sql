DROP POLICY "Read manageable or assigned surveys" ON public.surveys;
CREATE POLICY "Read manageable or published surveys"
ON public.surveys FOR SELECT TO authenticated
USING (public.can_manage_survey(auth.uid(), id) OR status = 'published'::survey_status);

DROP POLICY "Read sections accessible" ON public.survey_sections;
CREATE POLICY "Read sections accessible"
ON public.survey_sections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_sections.survey_id AND (public.can_manage_survey(auth.uid(), s.id) OR s.status = 'published'::survey_status)));

DROP POLICY "Read questions accessible" ON public.survey_questions;
CREATE POLICY "Read questions accessible"
ON public.survey_questions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_questions.survey_id AND (public.can_manage_survey(auth.uid(), s.id) OR s.status = 'published'::survey_status)));

DROP POLICY "Read options accessible" ON public.survey_question_options;
CREATE POLICY "Read options accessible"
ON public.survey_question_options FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.survey_questions q JOIN public.surveys s ON s.id = q.survey_id WHERE q.id = survey_question_options.question_id AND (public.can_manage_survey(auth.uid(), s.id) OR s.status = 'published'::survey_status)));