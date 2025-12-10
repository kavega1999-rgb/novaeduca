-- Add optional columns for training active time period
ALTER TABLE public.trainings
ADD COLUMN active_from timestamp with time zone DEFAULT NULL,
ADD COLUMN active_until timestamp with time zone DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.trainings.active_from IS 'Optional start date when the training becomes active';
COMMENT ON COLUMN public.trainings.active_until IS 'Optional end date when the training becomes inactive';