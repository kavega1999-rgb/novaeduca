-- Add leader_area_id to profiles to assign training areas to leaders
ALTER TABLE public.profiles 
ADD COLUMN leader_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.leader_area_id IS 'Training area assigned to leaders for filtering their visible trainings';