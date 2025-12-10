-- Drop existing restrictive policies on access_logs
DROP POLICY IF EXISTS "Admins can view all access logs" ON public.access_logs;
DROP POLICY IF EXISTS "Service role can insert access logs" ON public.access_logs;

-- Create PERMISSIVE policies (default behavior - at least one must be satisfied)
-- Only admins can read access logs
CREATE POLICY "Admins can view all access logs"
ON public.access_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role and authenticated users can insert (for logging purposes)
-- The edge function uses service role, but we keep it permissive for proper operation
CREATE POLICY "Service role can insert access logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);