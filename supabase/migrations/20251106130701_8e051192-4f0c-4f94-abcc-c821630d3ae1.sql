-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  time_limit_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create evaluation questions table
CREATE TABLE public.evaluation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create evaluation question options table (for multiple choice questions)
CREATE TABLE public.evaluation_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.evaluation_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create evaluation attempts table (user's evaluation submissions)
CREATE TABLE public.evaluation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score DECIMAL(5,2),
  max_score INTEGER NOT NULL,
  passed BOOLEAN,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress'
);

-- Create evaluation answers table (user's answers to questions)
CREATE TABLE public.evaluation_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.evaluation_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.evaluation_questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.evaluation_question_options(id) ON DELETE CASCADE,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all evaluation tables
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evaluations table
CREATE POLICY "Users can view evaluations for active trainings"
ON public.evaluations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trainings
    WHERE trainings.id = evaluations.training_id
    AND trainings.status = 'active'
  )
);

CREATE POLICY "Admins and leaders can manage evaluations"
ON public.evaluations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'));

-- RLS Policies for evaluation_questions table
CREATE POLICY "Users can view questions for active evaluations"
ON public.evaluation_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    JOIN public.trainings t ON e.training_id = t.id
    WHERE e.id = evaluation_questions.evaluation_id
    AND t.status = 'active'
  )
);

CREATE POLICY "Admins and leaders can manage questions"
ON public.evaluation_questions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'));

-- RLS Policies for evaluation_question_options table
CREATE POLICY "Users can view options for active questions"
ON public.evaluation_question_options
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluation_questions eq
    JOIN public.evaluations e ON eq.evaluation_id = e.id
    JOIN public.trainings t ON e.training_id = t.id
    WHERE eq.id = evaluation_question_options.question_id
    AND t.status = 'active'
  )
);

CREATE POLICY "Admins and leaders can manage options"
ON public.evaluation_question_options
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'));

-- RLS Policies for evaluation_attempts table
CREATE POLICY "Users can view their own attempts"
ON public.evaluation_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts"
ON public.evaluation_attempts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
ON public.evaluation_attempts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
ON public.evaluation_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for evaluation_answers table
CREATE POLICY "Users can view their own answers"
ON public.evaluation_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluation_attempts
    WHERE evaluation_attempts.id = evaluation_answers.attempt_id
    AND evaluation_attempts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own answers"
ON public.evaluation_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.evaluation_attempts
    WHERE evaluation_attempts.id = evaluation_answers.attempt_id
    AND evaluation_attempts.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all answers"
ON public.evaluation_answers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_evaluations_training_id ON public.evaluations(training_id);
CREATE INDEX idx_evaluation_questions_evaluation_id ON public.evaluation_questions(evaluation_id);
CREATE INDEX idx_evaluation_question_options_question_id ON public.evaluation_question_options(question_id);
CREATE INDEX idx_evaluation_attempts_user_id ON public.evaluation_attempts(user_id);
CREATE INDEX idx_evaluation_attempts_evaluation_id ON public.evaluation_attempts(evaluation_id);
CREATE INDEX idx_evaluation_answers_attempt_id ON public.evaluation_answers(attempt_id);

-- Create updated_at trigger for evaluations
CREATE TRIGGER update_evaluations_updated_at
BEFORE UPDATE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();