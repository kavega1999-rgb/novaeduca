-- Create access_logs table for audit trail
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  user_email text NOT NULL,
  user_role text,
  event_type text NOT NULL CHECK (event_type IN ('registro', 'login', 'logout')),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  country text,
  region text,
  user_agent text,
  device_type text,
  status text NOT NULL DEFAULT 'exitoso' CHECK (status IN ('exitoso', 'fallido')),
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view access logs
CREATE POLICY "Admins can view all access logs"
ON public.access_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Service role can insert (edge function will use service role)
CREATE POLICY "Service role can insert access logs"
ON public.access_logs FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_access_logs_event_timestamp ON public.access_logs(event_timestamp DESC);
CREATE INDEX idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX idx_access_logs_event_type ON public.access_logs(event_type);