-- Add target_count field to trainings (how many users should complete from target area)
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS target_user_count integer DEFAULT NULL;

-- Add is_finished field to mark training as completed by admin/leader
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS is_finished boolean DEFAULT false;

-- Add finished_at timestamp
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone DEFAULT NULL;

-- Add finished_by to track who marked it finished
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS finished_by uuid REFERENCES public.profiles(id) DEFAULT NULL;