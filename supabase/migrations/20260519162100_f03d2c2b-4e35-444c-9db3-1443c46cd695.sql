-- Create leader_areas table to allow leaders to manage multiple areas
CREATE TABLE public.leader_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, area_id)
);

CREATE INDEX idx_leader_areas_user ON public.leader_areas(user_id);
CREATE INDEX idx_leader_areas_area ON public.leader_areas(area_id);

ALTER TABLE public.leader_areas ENABLE ROW LEVEL SECURITY;

-- Only admins can manage leader-area assignments
CREATE POLICY "Admins can manage leader areas"
ON public.leader_areas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Leaders can view their own assignments
CREATE POLICY "Users can view their own leader areas"
ON public.leader_areas
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all leader areas"
ON public.leader_areas
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed from the existing single leader_area_id column
INSERT INTO public.leader_areas (user_id, area_id)
SELECT id, leader_area_id
FROM public.profiles
WHERE leader_area_id IS NOT NULL
ON CONFLICT (user_id, area_id) DO NOTHING;

-- Helper function: check if a user leads a given area
CREATE OR REPLACE FUNCTION public.is_leader_of_area(_user_id uuid, _area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leader_areas
    WHERE user_id = _user_id AND area_id = _area_id
  )
$$;