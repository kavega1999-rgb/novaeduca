-- Add requires_pretest column to trainings table
ALTER TABLE public.trainings
ADD COLUMN requires_pretest boolean DEFAULT false;

COMMENT ON COLUMN public.trainings.requires_pretest IS 'Determines if pretest must be completed before accessing training content';