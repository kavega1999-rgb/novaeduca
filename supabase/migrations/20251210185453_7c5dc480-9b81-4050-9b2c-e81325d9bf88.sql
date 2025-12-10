-- Table for storing pretest attempts separately from postest (evaluation_attempts)
CREATE TABLE public.pretest_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  score NUMERIC,
  max_score INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress'
);

-- Table for storing pretest answers
CREATE TABLE public.pretest_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES pretest_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES evaluation_questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES evaluation_question_options(id),
  text_response TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for adherence reports (comparing pretest vs postest)
CREATE TABLE public.adherence_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  pretest_attempt_id UUID REFERENCES pretest_attempts(id),
  postest_attempt_id UUID REFERENCES evaluation_attempts(id),
  pretest_score NUMERIC,
  postest_score NUMERIC,
  pretest_category TEXT,
  postest_category TEXT,
  improvement_percentage NUMERIC,
  conclusion TEXT,
  strategies TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pretest_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretest_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pretest_attempts
CREATE POLICY "Users can create their own pretest attempts"
ON public.pretest_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pretest attempts"
ON public.pretest_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pretest attempts"
ON public.pretest_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pretest attempts"
ON public.pretest_attempts FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can view all pretest attempts"
ON public.pretest_attempts FOR SELECT
USING (has_role(auth.uid(), 'leader'::app_role));

-- RLS Policies for pretest_answers
CREATE POLICY "Users can create their own pretest answers"
ON public.pretest_answers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM pretest_attempts
  WHERE pretest_attempts.id = pretest_answers.attempt_id
  AND pretest_attempts.user_id = auth.uid()
));

CREATE POLICY "Users can view their own pretest answers"
ON public.pretest_answers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM pretest_attempts
  WHERE pretest_attempts.id = pretest_answers.attempt_id
  AND pretest_attempts.user_id = auth.uid()
));

CREATE POLICY "Admins can view all pretest answers"
ON public.pretest_answers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can view all pretest answers"
ON public.pretest_answers FOR SELECT
USING (has_role(auth.uid(), 'leader'::app_role));

-- RLS Policies for adherence_reports
CREATE POLICY "Users can view their own adherence reports"
ON public.adherence_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all adherence reports"
ON public.adherence_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can view all adherence reports"
ON public.adherence_reports FOR SELECT
USING (has_role(auth.uid(), 'leader'::app_role));

CREATE POLICY "Service role can insert adherence reports"
ON public.adherence_reports FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update adherence reports"
ON public.adherence_reports FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_adherence_reports_updated_at
BEFORE UPDATE ON public.adherence_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add pretest_completed flag to user_progress
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS pretest_completed BOOLEAN DEFAULT false;

-- Add pretest_score to user_progress for quick reference
ALTER TABLE public.user_progress 
ADD COLUMN IF NOT EXISTS pretest_score NUMERIC;