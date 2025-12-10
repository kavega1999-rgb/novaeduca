-- Add text_response column for open-ended questions
ALTER TABLE public.evaluation_answers 
ADD COLUMN IF NOT EXISTS text_response TEXT;

-- Add column to track if AI grading is pending
ALTER TABLE public.evaluation_answers 
ADD COLUMN IF NOT EXISTS ai_feedback TEXT;