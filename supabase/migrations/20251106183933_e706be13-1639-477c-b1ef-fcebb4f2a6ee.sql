-- Create certificates table to store generated certificates/constancias
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.evaluation_attempts(id) ON DELETE SET NULL,
  certificate_type TEXT NOT NULL CHECK (certificate_type IN ('certificate', 'constancia')),
  file_url TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Users can view their own certificates
CREATE POLICY "Users can view their own certificates"
ON public.certificates
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all certificates
CREATE POLICY "Admins can view all certificates"
ON public.certificates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert certificates (we'll do this from edge function with service role)
CREATE POLICY "Service role can insert certificates"
ON public.certificates
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_certificates_user_training ON public.certificates(user_id, training_id);