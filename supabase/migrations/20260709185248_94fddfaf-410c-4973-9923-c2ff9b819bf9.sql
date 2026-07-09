
CREATE TABLE public.satisfaction_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  context TEXT NOT NULL DEFAULT 'general',
  context_id UUID,
  context_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.satisfaction_feedback TO authenticated;
GRANT ALL ON public.satisfaction_feedback TO service_role;

ALTER TABLE public.satisfaction_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
  ON public.satisfaction_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own feedback"
  ON public.satisfaction_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all feedback"
  ON public.satisfaction_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_satisfaction_feedback_created ON public.satisfaction_feedback(created_at DESC);
CREATE INDEX idx_satisfaction_feedback_context ON public.satisfaction_feedback(context, context_id);
