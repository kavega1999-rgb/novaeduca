-- Ensure RLS is enabled on access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well
ALTER TABLE public.access_logs FORCE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admins can view all access logs" ON public.access_logs;
DROP POLICY IF EXISTS "Service role can insert access logs" ON public.access_logs;

-- Create restrictive SELECT policy - ONLY admins can view
CREATE POLICY "Admins can view all access logs" 
ON public.access_logs 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create INSERT policy for service role (edge functions)
CREATE POLICY "Service role can insert access logs" 
ON public.access_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Explicitly deny public/anon access by not creating any policies for them
-- RLS is now enforced: no policy = no access