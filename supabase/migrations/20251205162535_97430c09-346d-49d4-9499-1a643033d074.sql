-- Add RLS policies for leaders to view all data in relevant tables

-- Allow leaders to view all user progress
CREATE POLICY "Leaders can view all progress" 
ON public.user_progress 
FOR SELECT 
USING (has_role(auth.uid(), 'leader'::app_role));

-- Allow leaders to view all evaluation attempts
CREATE POLICY "Leaders can view all attempts" 
ON public.evaluation_attempts 
FOR SELECT 
USING (has_role(auth.uid(), 'leader'::app_role));

-- Allow leaders to view all profiles
CREATE POLICY "Leaders can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'leader'::app_role));

-- Allow leaders to view all evaluation answers
CREATE POLICY "Leaders can view all answers" 
ON public.evaluation_answers 
FOR SELECT 
USING (has_role(auth.uid(), 'leader'::app_role));

-- Allow leaders to view all certificates
CREATE POLICY "Leaders can view all certificates" 
ON public.certificates 
FOR SELECT 
USING (has_role(auth.uid(), 'leader'::app_role));