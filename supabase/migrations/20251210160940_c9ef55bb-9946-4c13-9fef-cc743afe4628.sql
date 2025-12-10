-- Fix access_logs INSERT policy - remove public INSERT access
-- Service role already bypasses RLS, so edge function will still work
DROP POLICY IF EXISTS "Service role can insert access logs" ON public.access_logs;

-- No INSERT policy needed - only service role (from edge function) can insert
-- This prevents any authenticated user from injecting fake log entries